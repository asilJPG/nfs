import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/telegram/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Telegram tolerates ~30 messages/second to different chats; stay under it. */
const GAP_MS = 40;
const BATCH = 300;
const MAX_BROADCASTS_PER_RUN = 5;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Drains the broadcast queue. Runs every minute from Vercel Cron; each run
 * handles one batch per active broadcast, so a large audience simply takes
 * several runs. Safe to run concurrently with itself: a target that is already
 * sent is filtered out by status.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const now = new Date().toISOString();

  await db
    .from("stampy_broadcasts")
    .update({ status: "sending", started_at: now })
    .eq("status", "scheduled")
    .lte("scheduled_at", now);

  const { data: active } = await db
    .from("stampy_broadcasts")
    .select("id, body, image_url, button")
    .eq("status", "sending")
    .order("started_at", { ascending: true })
    .limit(MAX_BROADCASTS_PER_RUN);

  let sent = 0;
  let failed = 0;
  let rateLimited = false;

  for (const broadcast of active ?? []) {
    const { data: targets } = await db
      .from("stampy_broadcast_targets")
      .select("id, telegram_id, customer_id")
      .eq("broadcast_id", broadcast.id)
      .eq("status", "pending")
      .limit(BATCH);

    if (!targets?.length) {
      await finish(broadcast.id);
      continue;
    }

    for (const target of targets) {
      const result = await sendMessage({
        chatId: target.telegram_id,
        text: broadcast.body,
        imageUrl: broadcast.image_url,
        button: broadcast.button,
      });

      if (result.ok) {
        sent += 1;
        await db
          .from("stampy_broadcast_targets")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", target.id);
      } else if (result.kind === "rate_limited") {
        // Leave the target pending; the next run picks it up after the wait.
        rateLimited = true;
        break;
      } else if (result.kind === "blocked") {
        failed += 1;
        await Promise.all([
          db
            .from("stampy_broadcast_targets")
            .update({ status: "blocked", error: result.description })
            .eq("id", target.id),
          db
            .from("stampy_customers")
            .update({ can_message: false, blocked_at: new Date().toISOString() })
            .eq("id", target.customer_id),
        ]);
      } else {
        failed += 1;
        await db
          .from("stampy_broadcast_targets")
          .update({ status: "failed", error: result.description })
          .eq("id", target.id);
      }

      await sleep(GAP_MS);
    }

    await refreshCounts(broadcast.id);
    if (rateLimited) break;
  }

  return NextResponse.json({ sent, failed, rateLimited });
}

async function refreshCounts(broadcastId: string) {
  const db = supabaseAdmin();
  const [{ count: sentCount }, { count: failedCount }, { count: pendingCount }] = await Promise.all([
    db
      .from("stampy_broadcast_targets")
      .select("id", { count: "exact", head: true })
      .eq("broadcast_id", broadcastId)
      .eq("status", "sent"),
    db
      .from("stampy_broadcast_targets")
      .select("id", { count: "exact", head: true })
      .eq("broadcast_id", broadcastId)
      .in("status", ["failed", "blocked"]),
    db
      .from("stampy_broadcast_targets")
      .select("id", { count: "exact", head: true })
      .eq("broadcast_id", broadcastId)
      .eq("status", "pending"),
  ]);

  await db
    .from("stampy_broadcasts")
    .update({
      sent_count: sentCount ?? 0,
      failed_count: failedCount ?? 0,
      ...(pendingCount === 0
        ? { status: "done" as const, finished_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", broadcastId);
}

async function finish(broadcastId: string) {
  await supabaseAdmin()
    .from("stampy_broadcasts")
    .update({ status: "done", finished_at: new Date().toISOString() })
    .eq("id", broadcastId);
}
