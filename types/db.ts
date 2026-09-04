/**
 * Hand-written schema types. Regenerate with
 *   supabase gen types typescript --project-id <id> > types/db.ts
 * once the project is linked; until then this stays the contract.
 */

export type SubscriptionStatus = "trial" | "active" | "past_due" | "suspended";
export type TenantPlan = "loyalty" | "marketing";
export type StaffRole = "owner" | "manager" | "cashier";
export type StampSource = "nfc" | "manual";
export type RewardStatus = "earned" | "redeemed" | "expired";
export type BroadcastStatus = "draft" | "scheduled" | "sending" | "done" | "failed";
export type DeliveryStatus = "pending" | "sent" | "failed" | "blocked";
export type KitStatus = "requested" | "shipped" | "delivered" | "cancelled";

export type Brand = {
  primary: string;
  bg: string;
  surface: string;
  text: string;
  accent: string;
  card_style: "circles" | "cups" | "hearts" | "stars";
};

export type Segment =
  | { type: "all" }
  | { type: "inactive"; days: number }
  | { type: "new"; days: number }
  | { type: "close_to_reward"; remaining: number }
  | { type: "has_reward" };

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  brand: Brand;
  plan: TenantPlan;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string;
  subscription_until: string | null;
  daily_broadcast_cap: number;
  created_at: string;
  updated_at: string;
};

export type Venue = {
  id: string;
  tenant_id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  timezone: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type StaffUser = {
  id: string;
  tenant_id: string;
  auth_user_id: string | null;
  username: string;
  email: string | null;
  name: string | null;
  role: StaffRole;
  venue_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type LoyaltyProgram = {
  id: string;
  tenant_id: string;
  stamps_required: number;
  reward_title: string;
  reward_description: string | null;
  reward_expires_days: number | null;
  stamp_cooldown_minutes: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Customer = {
  id: string;
  telegram_id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  photo_url: string | null;
  language_code: string | null;
  can_message: boolean;
  blocked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Membership = {
  id: string;
  tenant_id: string;
  customer_id: string;
  stamps_count: number;
  lifetime_stamps: number;
  first_seen_at: string;
  last_stamp_at: string | null;
  public_code: string;
};

export type Stamp = {
  id: string;
  tenant_id: string;
  membership_id: string;
  venue_id: string | null;
  tag_id: string | null;
  source: StampSource;
  staff_user_id: string | null;
  created_at: string;
};

export type Reward = {
  id: string;
  tenant_id: string;
  membership_id: string;
  program_id: string;
  status: RewardStatus;
  title: string;
  earned_at: string;
  expires_at: string | null;
  redeemed_at: string | null;
  redeemed_by_staff: string | null;
  redeemed_venue_id: string | null;
  redeem_code: string | null;
  redeem_code_expires_at: string | null;
};

export type NfcTag = {
  id: string;
  tenant_id: string | null;
  venue_id: string | null;
  uid: string;
  key_version: number;
  last_counter: number;
  label: string | null;
  active: boolean;
  last_seen_at: string | null;
  created_at: string;
};

export type StampToken = {
  token: string;
  tenant_id: string;
  tag_id: string;
  venue_id: string | null;
  tap_counter: number;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
  consumed_by_membership: string | null;
};

export type Broadcast = {
  id: string;
  tenant_id: string;
  title: string | null;
  body: string;
  image_url: string | null;
  segment: Segment;
  button: { text: string; url: string } | null;
  status: BroadcastStatus;
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  sent_count: number;
  failed_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BroadcastTarget = {
  id: string;
  broadcast_id: string;
  tenant_id: string;
  customer_id: string;
  telegram_id: number;
  status: DeliveryStatus;
  error: string | null;
  attempts: number;
  sent_at: string | null;
};

export type KitOrder = {
  id: string;
  tenant_id: string;
  venue_id: string | null;
  contact_name: string;
  phone: string;
  address: string;
  note: string | null;
  status: KitStatus;
  created_at: string;
  updated_at: string;
};

export type ApplicationStatus = "new" | "contacted" | "converted" | "rejected";

export type Application = {
  id: string;
  cafe_name: string;
  city: string | null;
  contact_name: string;
  phone: string;
  telegram: string | null;
  message: string | null;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      stampy_tenants: Table<Tenant>;
      stampy_venues: Table<Venue>;
      stampy_staff_users: Table<StaffUser>;
      stampy_loyalty_programs: Table<LoyaltyProgram>;
      stampy_customers: Table<Customer>;
      stampy_memberships: Table<Membership>;
      stampy_stamps: Table<Stamp>;
      stampy_rewards: Table<Reward>;
      stampy_nfc_tags: Table<NfcTag>;
      stampy_stamp_tokens: Table<StampToken>;
      stampy_broadcasts: Table<Broadcast>;
      stampy_broadcast_targets: Table<BroadcastTarget>;
      stampy_kit_orders: Table<KitOrder>;
      stampy_platform_admins: Table<{ auth_user_id: string; email: string; created_at: string }>;
      stampy_applications: Table<Application>;
    };
    Views: Record<string, never>;
    Functions: {
      claim_stamp: {
        Args: { p_token: string; p_telegram_id: number; p_profile: Record<string, unknown> };
        Returns: ClaimStampResult;
      };
      ensure_membership: {
        Args: { p_tenant: string; p_telegram_id: number; p_profile: Record<string, unknown> };
        Returns: Membership;
      };
      add_manual_stamp: {
        Args: { p_tenant: string; p_public_code: string; p_venue: string | null };
        Returns: ManualStampResult;
      };
      issue_redeem_code: {
        Args: { p_reward: string; p_telegram_id: number; p_ttl_minutes?: number };
        Returns: IssueCodeResult;
      };
      redeem_reward: {
        Args: { p_tenant: string; p_code: string; p_venue: string | null };
        Returns: RedeemResult;
      };
      create_tenant: {
        Args: {
          p_name: string;
          p_slug: string;
          p_username: string;
          p_venue_name?: string | null;
          p_brand?: Brand | null;
          p_stamps?: number;
          p_reward?: string;
        };
        Returns: CreateTenantResult;
      };
      segment_customers: {
        Args: { p_tenant: string; p_segment: Segment };
        Returns: { customer_id: string; telegram_id: number }[];
      };
      analytics_overview: {
        Args: { p_tenant: string; p_from: string; p_to: string };
        Returns: AnalyticsOverview;
      };
      analytics_daily: {
        Args: { p_tenant: string; p_from: string; p_to: string; p_tz?: string };
        Returns: AnalyticsDay[];
      };
      analytics_heatmap: {
        Args: { p_tenant: string; p_from: string; p_to: string; p_tz?: string };
        Returns: { dow: number; hour: number; stamps: number }[];
      };
      analytics_cohorts: {
        Args: { p_tenant: string; p_months?: number; p_tz?: string };
        Returns: { cohort: string; cohort_size: number; month_offset: number; retained: number }[];
      };
      admin_set_subscription: {
        Args: {
          p_tenant: string;
          p_status: SubscriptionStatus;
          p_plan: TenantPlan;
          p_until: string | null;
        };
        Returns: { ok: boolean; code?: string };
      };
      admin_register_tag: {
        Args: { p_uid: string; p_tenant: string | null; p_venue: string | null; p_label: string | null };
        Returns: { ok: boolean; code?: string; uid?: string };
      };
      admin_set_kit_status: {
        Args: { p_kit: string; p_status: KitStatus };
        Returns: { ok: boolean };
      };
      admin_set_application_status: {
        Args: { p_id: string; p_status: "new" | "contacted" | "converted" | "rejected" };
        Returns: void;
      };
      admin_tenant_summary: {
        Args: Record<string, never>;
        Returns: TenantSummary[];
      };
      queue_broadcast: {
        Args: { p_broadcast: string };
        Returns: { ok: boolean; code?: string; recipients?: number };
      };
      segment_size: {
        Args: { p_tenant: string; p_segment: Segment };
        Returns: number;
      };
      username_available: {
        Args: { p_username: string };
        Returns: boolean;
      };
      expire_stale: {
        Args: Record<string, never>;
        Returns: { expired_rewards: number; deleted_tokens: number };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type ClaimStampResult =
  | {
      ok: true;
      membership_id: string;
      stamps_count: number;
      stamps_required: number;
      lifetime_stamps: number;
      reward: Reward | null;
    }
  | {
      ok: false;
      code:
        | "token_unknown"
        | "token_used"
        | "token_expired"
        | "tenant_inactive"
        | "no_program"
        | "cooldown";
      retry_after_seconds?: number;
      stamps_count?: number;
      stamps_required?: number;
    };

export type ManualStampResult =
  | { ok: true; stamps_count: number; stamps_required: number; reward_earned: boolean }
  | { ok: false; code: "tenant_inactive" | "no_program" | "card_not_found" };

export type IssueCodeResult =
  | { ok: true; code_value: string; expires_at: string }
  | { ok: false; code: string };

export type RedeemResult =
  | { ok: true; title: string; customer: string }
  | { ok: false; code: "not_found" | "code_expired" | "reward_expired" };

export type CreateTenantResult =
  | { ok: true; tenant_id: string; slug: string; venue_id: string; trial_ends_at: string }
  | { ok: false; code: "already_has_tenant" | "slug_taken" | "username_taken" };

export type TenantSummary = {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string;
  subscription_until: string | null;
  customers: number;
  stamps_30d: number;
  tags: number;
};

export type AnalyticsOverview = {
  stamps: number;
  unique_visitors: number;
  new_customers: number;
  active_cards: number;
  total_cards: number;
  rewards_earned: number;
  rewards_redeemed: number;
  rewards_outstanding: number;
};

export type AnalyticsDay = {
  day: string;
  stamps: number;
  new_customers: number;
  returning_customers: number;
};
