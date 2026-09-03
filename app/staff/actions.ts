"use server";

import { requireStaff } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type { ManualStampResult, RedeemResult } from "@/types/db";

export type ActionResult = { ok: boolean; message: string };

const REDEEM_ERRORS: Record<string, string> = {
  not_found: "Код не найден. Проверьте цифры.",
  code_expired: "Код истёк — попросите гостя обновить его.",
  reward_expired: "Срок награды истёк.",
};

const STAMP_ERRORS: Record<string, string> = {
  card_not_found: "Карта с таким кодом не найдена.",
  no_program: "Карта лояльности не настроена.",
  tenant_inactive: "Подписка неактивна — начисление приостановлено.",
};

/** Barista types the 4 digits the guest shows. */
export async function redeemAction(code: string, venueId: string | null): Promise<ActionResult> {
  const { tenant } = await requireStaff();
  const digits = code.replace(/\D/g, "");
  if (digits.length !== 4) return { ok: false, message: "Код состоит из 4 цифр." };

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("redeem_reward", {
    p_tenant: tenant.id,
    p_code: digits,
    p_venue: venueId,
  });

  if (error) {
    console.error("redeem_reward failed", error);
    return { ok: false, message: "Не удалось погасить награду. Попробуйте ещё раз." };
  }

  const result = data as RedeemResult;
  return result.ok
    ? { ok: true, message: `${result.customer}: ${result.title} — выдано` }
    : { ok: false, message: REDEEM_ERRORS[result.code] ?? "Не получилось." };
}

/** Fallback path when a tag or a phone fails: stamp by the card's short code. */
export async function manualStampAction(
  publicCode: string,
  venueId: string | null,
): Promise<ActionResult> {
  const { tenant } = await requireStaff();
  const normalized = publicCode.trim().toUpperCase();
  if (normalized.length !== 6) return { ok: false, message: "Код карты состоит из 6 символов." };

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("add_manual_stamp", {
    p_tenant: tenant.id,
    p_public_code: normalized,
    p_venue: venueId,
  });

  if (error) {
    console.error("add_manual_stamp failed", error);
    return { ok: false, message: "Не удалось начислить штамп." };
  }

  const result = data as ManualStampResult;
  if (!result.ok) return { ok: false, message: STAMP_ERRORS[result.code] ?? "Не получилось." };

  return {
    ok: true,
    message: result.reward_earned
      ? "Штамп начислен — карта заполнена, гостю доступна награда!"
      : `Штамп начислен: ${result.stamps_count} из ${result.stamps_required}`,
  };
}
