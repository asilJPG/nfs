import type { Tenant } from "@/types/db";

export type Feature = "broadcasts" | "advanced_analytics" | "extra_venues";

const PLAN_FEATURES: Record<string, Feature[]> = {
  loyalty: [],
  marketing: ["broadcasts", "advanced_analytics", "extra_venues"],
};

/** A trial gets everything, so the shop can see what it is paying for. */
export function can(
  tenant: Pick<Tenant, "plan" | "subscription_status" | "trial_ends_at" | "subscription_until">,
  feature: Feature,
): boolean {
  if (!isServing(tenant)) return false;
  if (tenant.subscription_status === "trial") return true;
  return PLAN_FEATURES[tenant.plan]?.includes(feature) ?? false;
}

/** Mirrors public.tenant_is_serving() in SQL — keep the two in step. */
export function isServing(
  tenant: Pick<Tenant, "subscription_status" | "trial_ends_at" | "subscription_until">,
): boolean {
  const now = Date.now();
  switch (tenant.subscription_status) {
    case "trial":
      return new Date(tenant.trial_ends_at).getTime() > now;
    case "active":
      return !tenant.subscription_until || new Date(tenant.subscription_until).getTime() > now;
    default:
      return false;
  }
}

export function daysLeftInTrial(tenant: Pick<Tenant, "subscription_status" | "trial_ends_at">): number | null {
  if (tenant.subscription_status !== "trial") return null;
  const ms = new Date(tenant.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export const MAX_VENUES_WITHOUT_UPGRADE = 1;
