import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/types/db";

let cached: SupabaseClient<Database> | null = null;

// service-role: обходит RLS, никогда не сувать сюда сырьё из запроса без проверки
export function supabaseAdmin(): SupabaseClient<Database> {
  if (!cached) {
    cached = createClient<Database>(env.supabaseUrl, env.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "X-Client-Info": "stampy-server" } },
    });
  }
  return cached;
}
