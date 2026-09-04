"use server";

import { requireStaff } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type { RedeemResult } from "@/types/db";

export type ActionResult = { ok: boolean; message: string };

const REDEEM_ERRORS: Record<string, string> = {
  not_found: "QR не найден. Попросите гостя обновить его.",
  code_expired: "QR истёк — попросите гостя обновить.",
  reward_expired: "Срок награды истёк.",
};

/** Barista scans the QR the guest shows. */
export async function redeemAction(token: string, venueId: string | null): Promise<ActionResult> {
  const { tenant } = await requireStaff();
  const cleaned = token.trim();
  if (!cleaned) return { ok: false, message: "Пустой QR." };

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("redeem_reward", {
    p_tenant: tenant.id,
    p_code: cleaned,
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
