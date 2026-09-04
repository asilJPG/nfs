import "server-only";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { StaffRole, StaffUser, Tenant } from "@/types/db";

export type StaffContext = { staff: StaffUser; tenant: Tenant };

type Client = Awaited<ReturnType<typeof supabaseServer>>;

/**
 * Invited staff have a row with no auth_user_id until they first sign in;
 * claim_staff_invite() links the two by email. Costs one extra round trip only
 * on that very first visit.
 */
/** Аккаунт и строка сотрудника создаются вместе, поэтому связь всегда готова. */
async function findStaff(supabase: Client, userId: string): Promise<StaffUser | null> {
  const { data } = await supabase
    .from("stampy_staff_users")
    .select("*")
    .eq("auth_user_id", userId)
    .eq("active", true)
    .maybeSingle();
  return data ?? null;
}

/**
 * The gate for every staff page. Sends anonymous visitors to the login screen
 * and brand-new accounts to onboarding, so a page body can assume both exist.
 */
export async function requireStaff(): Promise<StaffContext> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const staff = await findStaff(supabase, user.id);
  if (!staff) redirect("/login");

  const { data: tenant } = await supabase
    .from("stampy_tenants")
    .select("*")
    .eq("id", staff.tenant_id)
    .maybeSingle();
  // Only reachable if the tenant row vanished under us; treat it as signed out.
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

/** Null instead of a redirect — for pages that render differently when signed out. */
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
