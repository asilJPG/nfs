import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/types/db";

let cached: SupabaseClient<Database> | null = null;

/**
 * Service-role client. Bypasses RLS, so it must never be handed a value that
 * came straight from a request without being checked first. Used for mini-app
 * traffic (authenticated by Telegram initData, not by Postgres) and for cron.
 */
export function supabaseAdmin(): SupabaseClient<Database> {
  if (!cached) {
    cached = createClient<Database>(env.supabaseUrl, env.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "X-Client-Info": "stampy-server" } },
    });
  }
  return cached;
}
