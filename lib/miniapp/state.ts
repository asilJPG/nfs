import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isServing } from "@/lib/plan";
import type { Brand, Reward } from "@/types/db";

export type MiniAppState = {
  tenant: {
    id: string;
    slug: string;
    name: string;
    logo_url: string | null;
    brand: Brand;
    serving: boolean;
  };
  program: {
    stamps_required: number;
    reward_title: string;
    reward_description: string | null;
  } | null;
  card: {
    stamps_count: number;
    lifetime_stamps: number;
    public_code: string;
    last_stamp_at: string | null;
  } | null;
  rewards: Pick<Reward, "id" | "title" | "earned_at" | "expires_at">[];
  history: { created_at: string; venue: string | null }[];
  otherCards: { slug: string; name: string; logo_url: string | null; stamps_count: number }[];
};

type TenantBadge = { slug: string; name: string; logo_url: string | null };

const HISTORY_LIMIT = 20;

/** Everything the card screen needs, in one place, for one customer. */
export async function loadState(tenantId: string, telegramId: number | null): Promise<MiniAppState | null> {
  const db = supabaseAdmin();

  const { data: tenant } = await db
    .from("stampy_tenants")
    .select("id, slug, name, logo_url, brand, plan, subscription_status, trial_ends_at, subscription_until")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant) return null;

  const { data: program } = await db
    .from("stampy_loyalty_programs")
    .select("stamps_required, reward_title, reward_description")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .maybeSingle();

  const base: MiniAppState = {
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      logo_url: tenant.logo_url,
      brand: tenant.brand,
      serving: isServing(tenant),
    },
    program: program ?? null,
    card: null,
    rewards: [],
    history: [],
    otherCards: [],
  };

  if (telegramId === null) return base;

  const { data: customer } = await db
    .from("stampy_customers")
    .select("id")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (!customer) return base;

  const { data: membership } = await db
    .from("stampy_memberships")
    .select("id, stamps_count, lifetime_stamps, public_code, last_stamp_at")
    .eq("tenant_id", tenantId)
    .eq("customer_id", customer.id)
    .maybeSingle();
  if (!membership) return base;

  const [{ data: rewards }, { data: history }, { data: others }] = await Promise.all([
    db
      .from("stampy_rewards")
      .select("id, title, earned_at, expires_at")
      .eq("membership_id", membership.id)
      .eq("status", "earned")
      .order("earned_at", { ascending: true }),
    db
      .from("stampy_stamps")
      .select("created_at, stampy_venues(name)")
      .eq("membership_id", membership.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT)
      .returns<{ created_at: string; stampy_venues: { name: string } | null }[]>(),
    db
      .from("stampy_memberships")
      .select("stamps_count, stampy_tenants(slug, name, logo_url)")
      .eq("customer_id", customer.id)
      .neq("tenant_id", tenantId)
      .returns<{ stamps_count: number; stampy_tenants: TenantBadge | null }[]>(),
  ]);

  base.card = {
    stamps_count: membership.stamps_count,
    lifetime_stamps: membership.lifetime_stamps,
    public_code: membership.public_code,
    last_stamp_at: membership.last_stamp_at,
  };
  base.rewards = rewards ?? [];
  base.history = (history ?? []).map((row) => ({
    created_at: row.created_at,
    venue: row.stampy_venues?.name ?? null,
  }));
  base.otherCards = (others ?? []).flatMap((row) =>
    row.stampy_tenants ? [{ ...row.stampy_tenants, stamps_count: row.stamps_count }] : [],
  );

  return base;
}

export async function tenantIdBySlug(slug: string): Promise<string | null> {
  const { data } = await supabaseAdmin()
    .from("stampy_tenants")
    .select("id")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  return data?.id ?? null;
}
