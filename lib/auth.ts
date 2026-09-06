import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { currentImpersonation } from "@/lib/impersonate";
import type { StaffRole, StaffUser, Tenant } from "@/types/db";

export type StaffContext = { staff: StaffUser; tenant: Tenant; impersonating?: boolean };

type StaffWithTenant = StaffUser & { tenant: Tenant | null };

// React.cache — де-дублицирует вызовы в рамках одного запроса. Дашборд рендерит layout + page,
// у обоих requireStaff — раньше это давало 6 SQL-запросов на страницу, теперь 2.
const _requireStaff = cache(async (): Promise<StaffContext> => {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // импресонация — платформенный админ смотрит от лица кофейни
  const impersonateTenantId = await currentImpersonation();
  if (impersonateTenantId) {
    const { data: admin } = await supabase
      .from("stampy_platform_admins")
      .select("auth_user_id")
      .eq("auth_user_id", user.id)
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
    .eq("auth_user_id", user.id)
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
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("stampy_platform_admins")
    .select("auth_user_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!data) redirect("/dashboard");

  return { user };
});

// без редиректа — для страниц которые рендерятся иначе если не залогинен
export const currentStaff = cache(async (): Promise<StaffContext | null> => {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: row } = await supabase
    .from("stampy_staff_users")
    .select("*, tenant:stampy_tenants!inner(*)")
    .eq("auth_user_id", user.id)
    .eq("active", true)
    .maybeSingle<StaffWithTenant>();

  if (!row?.tenant) return null;
  const { tenant, ...staff } = row;
  return { staff: staff as StaffUser, tenant };
});
