"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LOGIN_PATTERN, MIN_PASSWORD_LENGTH, loginToAuthEmail, normalizeLogin } from "@/lib/login";
import { SLUG_PATTERN } from "@/lib/slug";
import type { KitStatus, SubscriptionStatus, TenantPlan } from "@/types/db";

export type Result = { ok: boolean; message: string };

const subscriptionSchema = z.object({
  tenantId: z.string().uuid(),
  status: z.enum(["trial", "active", "past_due", "suspended"]),
  plan: z.enum(["loyalty", "marketing"]),
  months: z.coerce.number().int().min(0).max(24),
});

export async function setSubscription(input: {
  tenantId: string;
  status: SubscriptionStatus;
  plan: TenantPlan;
  months: number;
}): Promise<Result> {
  await requirePlatformAdmin();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Проверьте параметры подписки." };

  const until =
    parsed.data.status === "active" && parsed.data.months > 0
      ? new Date(Date.now() + parsed.data.months * 30 * 86_400_000).toISOString()
      : null;

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("admin_set_subscription", {
    p_tenant: parsed.data.tenantId,
    p_status: parsed.data.status,
    p_plan: parsed.data.plan,
    p_until: until,
  });

  if (error) {
    console.error("admin_set_subscription failed", error);
    return { ok: false, message: "Не удалось обновить подписку." };
  }

  revalidatePath("/admin");
  return { ok: true, message: "Подписка обновлена." };
}

const tagSchema = z.object({
  uid: z.string().trim().regex(/^[0-9a-fA-F]{14}$/, "UID — 14 hex-символов"),
  tenantId: z.string().uuid().nullable(),
  label: z.string().trim().max(60).optional(),
});

/**
 * Registers a physical tag after it has been programmed. Keys are never stored
 * or shown here — they are derived from NFC_MASTER_KEY by scripts/mock-tag.ts.
 */
export async function registerTag(input: {
  uid: string;
  tenantId: string | null;
  label?: string;
}): Promise<Result> {
  await requirePlatformAdmin();
  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте UID." };
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("admin_register_tag", {
    p_uid: parsed.data.uid,
    p_tenant: parsed.data.tenantId,
    p_venue: null,
    p_label: parsed.data.label ?? null,
  });

  if (error) {
    console.error("admin_register_tag failed", error);
    return { ok: false, message: "Не удалось зарегистрировать метку." };
  }

  const result = data as { ok: boolean; code?: string; uid?: string };
  if (!result.ok) return { ok: false, message: "UID должен состоять из 14 hex-символов." };

  revalidatePath("/admin");
  return { ok: true, message: `Метка ${result.uid} зарегистрирована.` };
}

const createTenantSchema = z.object({
  applicationId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().regex(SLUG_PATTERN, "Адрес: латиница, цифры и дефис, от 3 символов"),
  login: z.string().trim().toLowerCase().regex(LOGIN_PATTERN, "Логин: латиница, цифры, точка, дефис"),
  password: z.string().min(MIN_PASSWORD_LENGTH),
  venueName: z.string().trim().max(80).optional(),
  stamps: z.coerce.number().int().min(2).max(20),
  reward: z.string().trim().min(1).max(60),
});

const CREATE_ERRORS: Record<string, string> = {
  slug_taken: "Такой адрес карты уже занят.",
  username_taken: "Такой логин уже занят.",
  already_has_tenant: "К этому аккаунту уже привязана кофейня.",
  user_not_found: "Не удалось создать аккаунт владельца.",
};

/**
 * Платформенный админ вручную заводит кофейню по заявке: создаёт auth-аккаунт
 * владельцу, создаёт тенант через admin_create_tenant, помечает заявку converted.
 */
export async function createTenantFromApplication(input: {
  applicationId?: string;
  name: string;
  slug: string;
  login: string;
  password: string;
  venueName?: string;
  stamps: number;
  reward: string;
}): Promise<Result> {
  await requirePlatformAdmin();
  const parsed = createTenantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте поля." };
  }

  const login = normalizeLogin(parsed.data.login);
  const admin = supabaseAdmin();

  const { data: free } = await admin.rpc("username_available", { p_username: login });
  if (free === false) return { ok: false, message: CREATE_ERRORS.username_taken };

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: loginToAuthEmail(login),
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { login, tenant_name: parsed.data.name },
  });

  if (createError || !created.user) {
    if (createError?.message?.includes("already been registered")) {
      return { ok: false, message: CREATE_ERRORS.username_taken };
    }
    console.error("createUser failed", createError);
    return { ok: false, message: "Не удалось создать аккаунт владельца." };
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("admin_create_tenant", {
    p_owner_auth_user: created.user.id,
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_username: login,
    p_venue_name: parsed.data.venueName ?? null,
    p_brand: null,
    p_stamps: parsed.data.stamps,
    p_reward: parsed.data.reward,
  });

  if (error) {
    console.error("admin_create_tenant failed", error);
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, message: "Не удалось создать кофейню." };
  }

  const result = data as { ok: boolean; code?: string; slug?: string };
  if (!result.ok) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, message: CREATE_ERRORS[result.code ?? ""] ?? "Не получилось." };
  }

  if (parsed.data.applicationId) {
    await supabase.rpc("admin_set_application_status", {
      p_id: parsed.data.applicationId,
      p_status: "converted",
    });
  }

  revalidatePath("/admin");
  return {
    ok: true,
    message: `Кофейня «${parsed.data.name}» создана. Логин: ${login}`,
  };
}

export async function setApplicationStatus(
  id: string,
  status: "new" | "contacted" | "converted" | "rejected",
): Promise<Result> {
  await requirePlatformAdmin();
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("admin_set_application_status", {
    p_id: id,
    p_status: status,
  });
  if (error) {
    console.error("admin_set_application_status failed", error);
    return { ok: false, message: "Не удалось обновить заявку." };
  }
  revalidatePath("/admin");
  return { ok: true, message: "Заявка обновлена." };
}

export async function setKitStatus(kitId: string, status: KitStatus): Promise<Result> {
  await requirePlatformAdmin();
  const supabase = await supabaseServer();

  const { error } = await supabase.rpc("admin_set_kit_status", { p_kit: kitId, p_status: status });
  if (error) return { ok: false, message: "Не удалось обновить заявку." };

  revalidatePath("/admin");
  return { ok: true, message: "Заявка обновлена." };
}
