import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { currentImpersonation } from "@/lib/impersonate";
import { env } from "@/lib/env";
import type { JWK } from "@supabase/supabase-js";
import type { StaffRole, StaffUser, Tenant } from "@/types/db";

export type StaffContext = { staff: StaffUser; tenant: Tenant; impersonating?: boolean };

type StaffWithTenant = StaffUser & { tenant: Tenant | null };

// JWKS проекта — публичные ключи, кешируем в модуле: клиент Supabase создаётся
// на каждый запрос заново и иначе тянул бы .well-known каждый раз.
const JWKS_TTL_MS = 10 * 60_000;
let jwksCache: { keys: JWK[] } | null = null;
let jwksFetchedAt = 0;

async function signingKeys(): Promise<{ keys: JWK[] } | null> {
  const now = Date.now();
  if (jwksCache && now - jwksFetchedAt < JWKS_TTL_MS) return jwksCache;
  try {
    const response = await fetch(`${env.supabaseUrl}/auth/v1/.well-known/jwks.json`, {
      next: { revalidate: 600 },
    });
    if (!response.ok) return jwksCache;
    jwksCache = (await response.json()) as { keys: JWK[] };
    jwksFetchedAt = now;
  } catch {
    // сеть моргнула — работаем на прошлом кеше, а если его нет, getClaims сходит сам
  }
  return jwksCache;
}

// getClaims проверяет подпись JWT локально по JWKS — в отличие от getUser(), который
// на каждый вызов ходит в Auth по сети (Supabase в Токио). Раньше таких походов было
// два на клик: один в middleware, второй здесь. Подделать claims нельзя: подпись
// проверяется криптографически, а к строкам всё равно пускает только RLS.
const currentUserId = cache(async (): Promise<string | null> => {
  const supabase = await supabaseServer();
  const jwks = await signingKeys();
  const { data } = await supabase.auth.getClaims(undefined, jwks ? { jwks } : undefined);
  return (data?.claims?.sub as string | undefined) ?? null;
});

// React.cache — де-дублицирует вызовы в рамках одного запроса. Дашборд рендерит layout + page,
// у обоих requireStaff — раньше это давало 6 SQL-запросов на страницу, теперь 2.
const _requireStaff = cache(async (): Promise<StaffContext> => {
  const userId = await currentUserId();
  if (!userId) redirect("/login");
  const supabase = await supabaseServer();

  // импресонация — платформенный админ смотрит от лица кофейни
  const impersonateTenantId = await currentImpersonation();
  if (impersonateTenantId) {
    const { data: admin } = await supabase
      .from("stampy_platform_admins")
      .select("auth_user_id")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (admin) {
      const { data: owner } = await supabase
        .from("stampy_staff_users")
        .select("*, tenant:stampy_tenants!inner(*)")
        .eq("tenant_id", impersonateTenantId)
        .eq("role", "owner")
        .eq("active", true)
        .maybeSingle<StaffWithTenant>();
      if (owner?.tenant) {
        const { tenant, ...staff } = owner;
        return { staff: staff as StaffUser, tenant, impersonating: true };
      }
    }
  }

  // один запрос: staff + tenant одним JOIN
  const { data: row } = await supabase
    .from("stampy_staff_users")
    .select("*, tenant:stampy_tenants!inner(*)")
    .eq("auth_user_id", userId)
    .eq("active", true)
    .maybeSingle<StaffWithTenant>();

  if (!row || !row.tenant) redirect("/login");
  const { tenant, ...staff } = row;
  return { staff: staff as StaffUser, tenant };
});

export const requireStaff = _requireStaff;

export async function requireRole(...roles: StaffRole[]): Promise<StaffContext> {
  const context = await requireStaff();
  if (!roles.includes(context.staff.role)) redirect("/staff");
  return context;
}

export const requirePlatformAdmin = cache(async () => {
  const userId = await currentUserId();
  if (!userId) redirect("/login");
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("stampy_platform_admins")
    .select("auth_user_id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (!data) redirect("/dashboard");

  return { userId };
});

// без редиректа — для страниц которые рендерятся иначе если не залогинен
export const currentStaff = cache(async (): Promise<StaffContext | null> => {
  const userId = await currentUserId();
  if (!userId) return null;
  const supabase = await supabaseServer();

  const { data: row } = await supabase
    .from("stampy_staff_users")
    .select("*, tenant:stampy_tenants!inner(*)")
    .eq("auth_user_id", userId)
    .eq("active", true)
    .maybeSingle<StaffWithTenant>();

  if (!row?.tenant) return null;
  const { tenant, ...staff } = row;
  return { staff: staff as StaffUser, tenant };
});
