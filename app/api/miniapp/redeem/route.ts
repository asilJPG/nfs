import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { InitDataError, resolveUser } from "@/lib/telegram/initData";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { IssueCodeResult } from "@/types/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  initData: z.string(),
  rewardId: z.string().uuid(),
});

/** Turns a reward into a 4-digit code the barista types in. Ownership is checked in SQL. */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  let telegramId: number;
  try {
    telegramId = resolveUser(parsed.data.initData).id;
  } catch (error) {
    const code = error instanceof InitDataError ? error.code : "invalid";
    return NextResponse.json({ error: code }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin().rpc("issue_redeem_code", {
    p_reward: parsed.data.rewardId,
    p_telegram_id: telegramId,
    p_ttl_minutes: 5,
  });

  if (error) {
    console.error("issue_redeem_code failed", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }

  const result = data as IssueCodeResult;
  if (!result.ok) {
    return NextResponse.json({ error: result.code }, { status: 409 });
  }

  return NextResponse.json(
    { code: result.code_value, expiresAt: result.expires_at },
    { headers: { "cache-control": "no-store" } },
  );
}
