"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { can } from "@/lib/plan";
import type { Segment } from "@/types/db";

export type Result = { ok: boolean; message: string };

const segmentSchema: z.ZodType<Segment> = z.union([
  z.object({ type: z.literal("all") }),
  z.object({ type: z.literal("inactive"), days: z.coerce.number().int().min(1).max(365) }),
  z.object({ type: z.literal("new"), days: z.coerce.number().int().min(1).max(365) }),
  z.object({ type: z.literal("close_to_reward"), remaining: z.coerce.number().int().min(1).max(10) }),
  z.object({ type: z.literal("has_reward") }),
]);

const draftSchema = z.object({
  body: z.string().trim().min(1).max(3500),
  segment: segmentSchema,
  scheduledAt: z.string().datetime().nullable(),
});

const QUEUE_ERRORS: Record<string, string> = {
  empty_audience: "В этом сегменте сейчас никого нет.",
  daily_cap: "На сегодня лимит рассылок исчерпан. Попробуйте завтра.",
  tenant_inactive: "Подписка неактивна — рассылки приостановлены.",
  already_queued: "Рассылка уже отправляется.",
  not_found: "Рассылка не найдена.",
};

export async function segmentSize(segment: Segment): Promise<number> {
  const { tenant } = await requireRole("owner", "manager");
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc("segment_size", { p_tenant: tenant.id, p_segment: segment });
  return data ?? 0;
}

/** Creates the draft and immediately materialises its audience. */
export async function sendBroadcast(input: z.input<typeof draftSchema>): Promise<Result> {
  const { tenant, staff } = await requireRole("owner", "manager");
  if (!can(tenant, "broadcasts")) {
    return { ok: false, message: "Рассылки доступны на тарифе с маркетингом." };
  }

  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Проверьте текст сообщения." };

  const supabase = await supabaseServer();
  const { data: draft, error } = await supabase
    .from("broadcasts")
    .insert({
      tenant_id: tenant.id,
      body: parsed.data.body,
      segment: parsed.data.segment,
      scheduled_at: parsed.data.scheduledAt,
      created_by: staff.id,
    })
    .select("id")
    .single();

  if (error || !draft) {
    console.error("broadcast insert failed", error);
    return { ok: false, message: "Не удалось создать рассылку." };
  }

  const { data: queued, error: queueError } = await supabase.rpc("queue_broadcast", {
    p_broadcast: draft.id,
  });

  if (queueError) {
    console.error("queue_broadcast failed", queueError);
    return { ok: false, message: "Не удалось поставить рассылку в очередь." };
  }

  const result = queued as { ok: boolean; code?: string; recipients?: number };
  if (!result.ok) {
    await supabase.from("broadcasts").delete().eq("id", draft.id);
    return { ok: false, message: QUEUE_ERRORS[result.code ?? ""] ?? "Не получилось." };
  }

  revalidatePath("/dashboard/broadcasts");
  return {
    ok: true,
    message: parsed.data.scheduledAt
      ? `Запланировано для ${result.recipients} получателей.`
      : `Отправляем ${result.recipients} получателям — займёт пару минут.`,
  };
}

export async function cancelBroadcast(broadcastId: string): Promise<Result> {
  const { tenant } = await requireRole("owner", "manager");
  const supabase = await supabaseServer();

  const { error } = await supabase
    .from("broadcasts")
    .update({ status: "failed", finished_at: new Date().toISOString() })
    .eq("id", broadcastId)
    .eq("tenant_id", tenant.id)
    .in("status", ["scheduled", "sending"]);

  if (error) return { ok: false, message: "Не удалось отменить." };
  revalidatePath("/dashboard/broadcasts");
  return { ok: true, message: "Рассылка остановлена. Уже отправленные сообщения не отзываются." };
}
