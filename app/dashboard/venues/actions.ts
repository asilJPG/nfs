"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { can, MAX_VENUES_WITHOUT_UPGRADE } from "@/lib/plan";
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
    .from("venues")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .eq("active", true);

  if ((count ?? 0) >= MAX_VENUES_WITHOUT_UPGRADE && !can(tenant, "extra_venues")) {
    return {
      ok: false,
      message: "На текущем тарифе доступна одна точка. Дополнительные — на тарифе с маркетингом.",
    };
  }

  const { error } = await supabase.from("venues").insert({
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
    .from("venues")
    .update({ active })
    .eq("id", venueId)
    .eq("tenant_id", tenant.id);

  if (error) return { ok: false, message: "Не удалось изменить точку." };
  revalidatePath("/dashboard/venues");
  return { ok: true, message: active ? "Точка снова активна." : "Точка отключена." };
}

const staffSchema = z.object({
  email: z.string().trim().email().max(200),
  role: z.enum(["manager", "cashier"]),
  venueId: z.string().uuid().nullable(),
});

/**
 * Creates the staff row now; it links to a real account the first time that
 * person signs in with the same email (claim_staff_invite).
 */
export async function inviteStaff(input: {
  email: string;
  role: StaffRole;
  venueId: string | null;
}): Promise<Result> {
  const { tenant } = await requireRole("owner", "manager");
  const parsed = staffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Проверьте адрес почты и роль." };

  const supabase = await supabaseServer();
  const { error } = await supabase.from("staff_users").insert({
    tenant_id: tenant.id,
    email: parsed.data.email.toLowerCase(),
    role: parsed.data.role,
    venue_id: parsed.data.venueId,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, message: "Такой сотрудник уже добавлен." };
    console.error("staff insert failed", error);
    return { ok: false, message: "Не удалось добавить сотрудника." };
  }

  revalidatePath("/dashboard/venues");
  return {
    ok: true,
    message: `Готово. ${parsed.data.email} войдёт на ${process.env.NEXT_PUBLIC_APP_URL ?? ""}/login по этой почте.`,
  };
}

export async function removeStaff(staffId: string): Promise<Result> {
  const { tenant, staff } = await requireRole("owner", "manager");
  if (staffId === staff.id) return { ok: false, message: "Себя удалить нельзя." };

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("staff_users")
    .update({ active: false })
    .eq("id", staffId)
    .eq("tenant_id", tenant.id);

  if (error) return { ok: false, message: "Не удалось отключить сотрудника." };
  revalidatePath("/dashboard/venues");
  return { ok: true, message: "Сотрудник отключён." };
}
