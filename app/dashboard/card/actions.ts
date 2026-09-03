"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type { Brand } from "@/types/db";

export type SaveResult = { ok: boolean; message: string };

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  logoUrl: z.string().url().nullable(),
  brand: z.object({
    primary: hex,
    bg: hex,
    surface: hex,
    text: hex,
    accent: hex,
    card_style: z.enum(["circles", "cups", "hearts", "stars"]),
  }),
  program: z.object({
    stamps_required: z.coerce.number().int().min(2).max(20),
    reward_title: z.string().trim().min(1).max(60),
    reward_description: z.string().trim().max(200).nullable(),
    reward_expires_days: z.coerce.number().int().min(1).max(365).nullable(),
    stamp_cooldown_minutes: z.coerce.number().int().min(0).max(1440),
  }),
});

export type CardSettingsInput = z.input<typeof schema>;

/**
 * Saves brand and card rules together — they are one decision for the owner.
 * Changing stamps_required does not touch cards already in progress: existing
 * counts stay, the new target simply applies from the next stamp.
 */
export async function saveCardSettings(input: CardSettingsInput): Promise<SaveResult> {
  const { tenant } = await requireRole("owner", "manager");

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте поля." };
  }

  const supabase = await supabaseServer();

  const { error: tenantError } = await supabase
    .from("stampy_tenants")
    .update({
      name: parsed.data.name,
      logo_url: parsed.data.logoUrl,
      brand: parsed.data.brand as Brand,
    })
    .eq("id", tenant.id);

  if (tenantError) {
    console.error("tenant update failed", tenantError);
    return { ok: false, message: "Не удалось сохранить оформление." };
  }

  const { error: programError } = await supabase
    .from("stampy_loyalty_programs")
    .update(parsed.data.program)
    .eq("tenant_id", tenant.id)
    .eq("active", true);

  if (programError) {
    console.error("program update failed", programError);
    return { ok: false, message: "Не удалось сохранить условия карты." };
  }

  revalidatePath("/dashboard/card");
  return { ok: true, message: "Сохранено. Гости увидят изменения сразу." };
}
