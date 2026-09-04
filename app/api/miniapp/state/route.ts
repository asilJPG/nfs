import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { InitDataError, profileOf, resolveUser } from "@/lib/telegram/initData";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadState, tenantIdBySlug, type MiniAppState } from "@/lib/miniapp/state";
import { rememberedTenant, rememberTenant } from "@/lib/session";
import type { ClaimStampResult, Reward } from "@/types/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  initData: z.string(),
  startParam: z.string().max(128).optional(),
});

export type ClaimOutcome =
  | { kind: "stamped"; stamps_count: number; stamps_required: number; reward: Reward | null }
  | { kind: "already_counted" }
  | { kind: "cooldown"; retry_after_seconds: number }
  | { kind: "error"; code: string };

export type StateResponse = { state: MiniAppState; claim: ClaimOutcome | null };

const SLUG_PREFIX = "t_";

/**
 * The mini app's only entry point. It authenticates the customer with Telegram's
 * signed payload, works out which coffee shop this session is about, banks the
 * stamp if the customer arrived by tapping a tag, and returns the card.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  let user;
  try {
    user = resolveUser(parsed.data.initData);
  } catch (error) {
    const code = error instanceof InitDataError ? error.code : "invalid";
    const detail = (error as { detail?: unknown }).detail;
    return NextResponse.json(
      {
        error: code,
        debug: {
          initDataLen: parsed.data.initData.length,
          initDataHead: parsed.data.initData.slice(0, 200),
          nodeEnv: process.env.NODE_ENV,
          ...(detail && typeof detail === "object" ? detail : {}),
        },
      },
      { status: 401 },
    );
  }

  const db = supabaseAdmin();
  const startParam = parsed.data.startParam?.trim() || undefined;
  let tenantId: string | null = null;
  let claim: ClaimOutcome | null = null;

  if (startParam?.startsWith(SLUG_PREFIX)) {
    // Arrived from the counter QR or a shared link: just join the card.
    tenantId = await tenantIdBySlug(startParam.slice(SLUG_PREFIX.length));
    if (tenantId) {
      await db.rpc("ensure_membership", {
        p_tenant: tenantId,
        p_telegram_id: user.id,
        p_profile: profileOf(user),
      });
    }
  } else if (startParam) {
    const result = await claimTap(startParam, user.id, profileOf(user));
    tenantId = result.tenantId;
    claim = result.outcome;
  }

  if (!tenantId) tenantId = await rememberedTenant();
  if (!tenantId) {
    return NextResponse.json({ error: "no_tenant" }, { status: 404 });
  }

  const state = await loadState(tenantId, user.id);
  if (!state) {
    return NextResponse.json({ error: "no_tenant" }, { status: 404 });
  }

  await rememberTenant(tenantId);
  return NextResponse.json({ state, claim } satisfies StateResponse, {
    headers: { "cache-control": "no-store" },
  });
}

type TapProfile = ReturnType<typeof profileOf>;

async function claimTap(
  token: string,
  telegramId: number,
  profile: TapProfile,
): Promise<{ tenantId: string | null; outcome: ClaimOutcome }> {
  const db = supabaseAdmin();

  const { data: tokenRow } = await db
    .from("stampy_stamp_tokens")
    .select("tenant_id, consumed_by_membership")
    .eq("token", token)
    .maybeSingle();

  if (!tokenRow) {
    return { tenantId: null, outcome: { kind: "error", code: "token_unknown" } };
  }

  const { data, error } = await db.rpc("claim_stamp", {
    p_token: token,
    p_telegram_id: telegramId,
    p_profile: profile,
  });

  if (error) {
    console.error("claim_stamp failed", error);
    return { tenantId: tokenRow.tenant_id, outcome: { kind: "error", code: "server" } };
  }

  const result = data as ClaimStampResult;
  if (result.ok) {
    return {
      tenantId: tokenRow.tenant_id,
      outcome: {
        kind: "stamped",
        stamps_count: result.stamps_count,
        stamps_required: result.stamps_required,
        reward: result.reward,
      },
    };
  }

  if (result.code === "cooldown") {
    return {
      tenantId: tokenRow.tenant_id,
      outcome: { kind: "cooldown", retry_after_seconds: result.retry_after_seconds ?? 0 },
    };
  }

  // A reload, a back button or React's double effect in dev replays the same
  // token. If it was this customer's own tap, that is not an error to show.
  if (result.code === "token_used" && tokenRow.consumed_by_membership) {
    const { data: owner } = await db
      .from("stampy_memberships")
      .select("stampy_customers(telegram_id)")
      .eq("id", tokenRow.consumed_by_membership)
      .maybeSingle();
    const ownerTelegramId = (owner as { stampy_customers?: { telegram_id: number } | null } | null)?.stampy_customers
      ?.telegram_id;
    if (ownerTelegramId === telegramId) {
      return { tenantId: tokenRow.tenant_id, outcome: { kind: "already_counted" } };
    }
  }

  return { tenantId: tokenRow.tenant_id, outcome: { kind: "error", code: result.code } };
}
