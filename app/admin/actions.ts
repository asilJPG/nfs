"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
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

export async function setKitStatus(kitId: string, status: KitStatus): Promise<Result> {
  await requirePlatformAdmin();
  const supabase = await supabaseServer();

  const { error } = await supabase.rpc("admin_set_kit_status", { p_kit: kitId, p_status: status });
  if (error) return { ok: false, message: "Не удалось обновить заявку." };

  revalidatePath("/admin");
  return { ok: true, message: "Заявка обновлена." };
}
