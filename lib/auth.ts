import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { currentImpersonation } from "@/lib/impersonate";
import type { StaffRole, StaffUser, Tenant } from "@/types/db";

export type StaffContext = { staff: StaffUser; tenant: Tenant; impersonating?: boolean };

type Client = Awaited<ReturnType<typeof supabaseServer>>;

async function findStaff(supabase: Client, userId: string): Promise<StaffUser | null> {
  const { data } = await supabase
    .from("stampy_staff_users")
    .select("*")
    .eq("auth_user_id", userId)
    .eq("active", true)
    .maybeSingle();
  return data ?? null;
}

// ворота для всех страниц сотрудника — тело страницы уже может рассчитывать что staff и tenant есть
export async function requireStaff(): Promise<StaffContext> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // если платформенный админ смотрит от лица кофейни — подставляем её владельца
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
        .select("*")
        .eq("tenant_id", impersonateTenantId)
        .eq("role", "owner")
        .eq("active", true)
        .maybeSingle();
      const { data: tenant } = await supabase
        .from("stampy_tenants")
        .select("*")
        .eq("id", impersonateTenantId)
        .maybeSingle();
      if (owner && tenant) return { staff: owner, tenant, impersonating: true };
    }
  }

  const staff = await findStaff(supabase, user.id);
  if (!staff) redirect("/login");

  const { data: tenant } = await supabase
    .from("stampy_tenants")
    .select("*")
    .eq("id", staff.tenant_id)
    .maybeSingle();
  // если tenant пропал под нами — считаем разлогиненным
  if (!tenant) redirect("/login");

  return { staff, tenant };
}

export async function requireRole(...roles: StaffRole[]): Promise<StaffContext> {
  const context = await requireStaff();
  if (!roles.includes(context.staff.role)) redirect("/staff");
  return context;
}

export async function requirePlatformAdmin() {
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
}

// без редиректа — для страниц, которые рендерятся иначе если не залогинен
export async function currentStaff(): Promise<StaffContext | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const staff = await findStaff(supabase, user.id);
  if (!staff) return null;

  const { data: tenant } = await supabase.from("stampy_tenants").select("*").eq("id", staff.tenant_id).single();
  return tenant ? { staff, tenant } : null;
}
