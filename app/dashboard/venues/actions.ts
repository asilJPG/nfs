"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { can, MAX_VENUES_WITHOUT_UPGRADE } from "@/lib/plan";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loginToAuthEmail, LOGIN_PATTERN, MIN_PASSWORD_LENGTH, normalizeLogin } from "@/lib/login";
import type { StaffRole } from "@/types/db";

export type Result = { ok: boolean; message: string };

const venueSchema = z.object({
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().max(200).optional(),
});

export async function addVenue(input: { name: string; address?: string }): Promise<Result> {
  const { tenant } = await requireRole("owner", "manager");
  const parsed = venueSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Название точки: от 2 до 80 символов." };

  const supabase = await supabaseServer();
  const { count } = await supabase
    .from("stampy_venues")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .eq("active", true);

  if ((count ?? 0) >= MAX_VENUES_WITHOUT_UPGRADE && !can(tenant, "extra_venues")) {
    return {
      ok: false,
      message: "На текущем тарифе доступна одна точка. Дополнительные — на тарифе с маркетингом.",
    };
  }

  const { error } = await supabase.from("stampy_venues").insert({
    tenant_id: tenant.id,
    name: parsed.data.name,
    address: parsed.data.address || null,
  });
  if (error) {
    console.error("venue insert failed", error);
    return { ok: false, message: "Не удалось добавить точку." };
  }

  revalidatePath("/dashboard/venues");
  return { ok: true, message: "Точка добавлена." };
}

export async function setVenueActive(venueId: string, active: boolean): Promise<Result> {
  const { tenant } = await requireRole("owner", "manager");
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("stampy_venues")
    .update({ active })
    .eq("id", venueId)
    .eq("tenant_id", tenant.id);

  if (error) return { ok: false, message: "Не удалось изменить точку." };
  revalidatePath("/dashboard/venues");
  return { ok: true, message: active ? "Точка снова активна." : "Точка отключена." };
}

const staffSchema = z.object({
  login: z.string().trim().toLowerCase().regex(LOGIN_PATTERN, "Логин: латиница, цифры, точка, дефис"),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Пароль от ${MIN_PASSWORD_LENGTH} символов`),
  name: z.string().trim().max(80).optional(),
  role: z.enum(["manager", "cashier"]),
  venueId: z.string().uuid().nullable(),
});

// владелец сам придумывает логин с паролем и передаёт лично
export async function createStaff(input: {
  login: string;
  password: string;
  name?: string;
  role: StaffRole;
  venueId: string | null;
}): Promise<Result> {
  const { tenant, staff: caller } = await requireRole("owner", "manager");
  const parsed = staffSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте поля." };
  }

  // управляющий заводит только бариста; управляющих и владельцев — только владелец
  if (parsed.data.role !== "cashier" && caller.role !== "owner") {
    return { ok: false, message: "Управляющих заводит только владелец." };
  }

  if (parsed.data.venueId) {
    const check = await supabaseServer();
    const { data: venue } = await check
      .from("stampy_venues")
      .select("id")
      .eq("id", parsed.data.venueId)
      .eq("tenant_id", tenant.id)
      .maybeSingle();
    if (!venue) return { ok: false, message: "Точка не найдена." };
  }

  const login = normalizeLogin(parsed.data.login);
  const admin = supabaseAdmin();

  const { data: free } = await admin.rpc("username_available", { p_username: login });
  if (free === false) return { ok: false, message: "Такой логин уже занят." };

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: loginToAuthEmail(login),
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { login, tenant_id: tenant.id },
  });
  if (createError || !created.user) {
    console.error("staff createUser failed", createError);
    return { ok: false, message: "Не удалось создать аккаунт сотрудника." };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.from("stampy_staff_users").insert({
    tenant_id: tenant.id,
    auth_user_id: created.user.id,
    username: login,
    name: parsed.data.name || null,
    role: parsed.data.role,
    venue_id: parsed.data.venueId,
  });

  if (error) {
    await admin.auth.admin.deleteUser(created.user.id);
    console.error("staff insert failed", error);
    return { ok: false, message: "Не удалось добавить сотрудника." };
  }

  revalidatePath("/dashboard/venues");
  return { ok: true, message: `Готово. Логин ${login} — передайте пароль сотруднику лично.` };
}

// пароль забыли — владелец назначает новый
export async function resetStaffPassword(staffId: string, password: string): Promise<Result> {
  const { tenant, staff: caller } = await requireRole("owner", "manager");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `Пароль от ${MIN_PASSWORD_LENGTH} символов.` };
  }

  const supabase = await supabaseServer();
  const { data: member } = await supabase
    .from("stampy_staff_users")
    .select("auth_user_id, username, role")
    .eq("id", staffId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  if (!member?.auth_user_id) return { ok: false, message: "Сотрудник не найден." };

  // управляющий не может ронять пароль ни владельцу, ни другому управляющему
  if (member.role === "owner" && caller.role !== "owner") {
    return { ok: false, message: "Пароль владельца может менять только сам владелец." };
  }
  if (member.role === "manager" && caller.role !== "owner" && caller.id !== staffId) {
    return { ok: false, message: "Пароль управляющего меняет владелец." };
  }

  const { error } = await supabaseAdmin().auth.admin.updateUserById(member.auth_user_id, {
    password,
  });
  if (error) {
    console.error("password reset failed", error);
    return { ok: false, message: "Не удалось сменить пароль." };
  }

  return { ok: true, message: `Пароль для ${member.username} обновлён.` };
}

export async function removeStaff(staffId: string): Promise<Result> {
  const { tenant, staff } = await requireRole("owner", "manager");
  if (staffId === staff.id) return { ok: false, message: "Себя удалить нельзя." };

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("stampy_staff_users")
    .update({ active: false })
    .eq("id", staffId)
    .eq("tenant_id", tenant.id);

  if (error) return { ok: false, message: "Не удалось отключить сотрудника." };
  revalidatePath("/dashboard/venues");
  return { ok: true, message: "Сотрудник отключён." };
}
