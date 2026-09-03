import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Nightly housekeeping: expire stale rewards, drop spent tap tokens. */
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin().rpc("expire_stale");
  if (error) {
    console.error("expire_stale failed", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  return NextResponse.json(data);
}
