-- Stampy — loyalty SaaS for coffee shops.
-- Tenancy: every business row carries tenant_id; staff access is gated by RLS.
-- Mini-app stampy_customers never authenticate against Postgres — their requests are
-- proven by Telegram initData in the API layer and executed with the service role.

create type subscription_status as enum ('trial', 'active', 'past_due', 'suspended');
create type tenant_plan          as enum ('loyalty', 'marketing');
create type staff_role           as enum ('owner', 'manager', 'cashier');
create type stamp_source         as enum ('nfc', 'manual');
create type reward_status        as enum ('earned', 'redeemed', 'expired');
create type broadcast_status     as enum ('draft', 'scheduled', 'sending', 'done', 'failed');
create type delivery_status      as enum ('pending', 'sent', 'failed', 'blocked');
create type kit_status           as enum ('requested', 'shipped', 'delivered', 'cancelled');

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- stampy_tenants ---

create table stampy_tenants (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique
                        check (slug ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'),
  name                text not null check (length(trim(name)) between 1 and 80),
  logo_url            text,
  brand               jsonb not null default '{"primary":"#6F4E37","bg":"#FFF8F0","surface":"#FFFFFF","text":"#2A1E17","accent":"#C8A27A","card_style":"circles"}'::jsonb,
  plan                tenant_plan not null default 'loyalty',
  subscription_status subscription_status not null default 'trial',
  trial_ends_at       timestamptz not null default now() + interval '30 days',
  subscription_until  timestamptz,
  daily_broadcast_cap smallint not null default 1 check (daily_broadcast_cap between 0 and 10),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger tenants_touch before update on stampy_tenants
  for each row execute function public.touch_updated_at();

create table stampy_platform_admins (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  created_at   timestamptz not null default now()
);

create table stampy_venues (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references stampy_tenants(id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 80),
  address    text,
  lat        double precision,
  lng        double precision,
  timezone   text not null default 'Asia/Tashkent',
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index venues_tenant_idx on stampy_venues (tenant_id) where active;
create trigger venues_touch before update on stampy_venues
  for each row execute function public.touch_updated_at();

create table stampy_staff_users (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references stampy_tenants(id) on delete cascade,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email        text not null,
  name         text,
  role         staff_role not null default 'cashier',
  venue_id     uuid references stampy_venues(id) on delete set null, -- null = all stampy_venues
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant_id, email)
);
create index staff_users_tenant_idx on stampy_staff_users (tenant_id);
create trigger staff_users_touch before update on stampy_staff_users
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------- loyalty ----

create table stampy_loyalty_programs (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references stampy_tenants(id) on delete cascade,
  stamps_required        smallint not null default 6 check (stamps_required between 2 and 20),
  reward_title           text not null default 'Бесплатный кофе'
                           check (length(trim(reward_title)) between 1 and 60),
  reward_description     text,
  reward_expires_days    smallint check (reward_expires_days between 1 and 365),
  stamp_cooldown_minutes smallint not null default 15 check (stamp_cooldown_minutes between 0 and 1440),
  active                 boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
-- v1 allows exactly one live card per tenant; the shape already supports more.
create unique index loyalty_programs_one_active on stampy_loyalty_programs (tenant_id) where active;
create trigger loyalty_programs_touch before update on stampy_loyalty_programs
  for each row execute function public.touch_updated_at();

create table stampy_customers (
  id            uuid primary key default gen_random_uuid(),
  telegram_id   bigint not null unique,
  first_name    text,
  last_name     text,
  username      text,
  photo_url     text,
  language_code text,
  can_message   boolean not null default true,
  blocked_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger customers_touch before update on stampy_customers
  for each row execute function public.touch_updated_at();

create table stampy_memberships (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references stampy_tenants(id) on delete cascade,
  customer_id     uuid not null references stampy_customers(id) on delete cascade,
  stamps_count    smallint not null default 0 check (stamps_count >= 0),
  lifetime_stamps integer not null default 0 check (lifetime_stamps >= 0),
  first_seen_at   timestamptz not null default now(),
  last_stamp_at   timestamptz,
  -- Short human code the cashier can type when NFC fails.
  public_code     text not null,
  unique (tenant_id, customer_id),
  unique (tenant_id, public_code)
);
create index memberships_tenant_last_stamp_idx on stampy_memberships (tenant_id, last_stamp_at desc nulls last);
create index memberships_customer_idx on stampy_memberships (customer_id);

-- Append-only ledger. stampy_memberships.stamps_count is a cache over this table.
create table stampy_stamps (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references stampy_tenants(id) on delete cascade,
  membership_id uuid not null references stampy_memberships(id) on delete cascade,
  venue_id      uuid references stampy_venues(id) on delete set null,
  tag_id        uuid,
  source        stamp_source not null default 'nfc',
  staff_user_id uuid references stampy_staff_users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index stamps_tenant_created_idx on stampy_stamps (tenant_id, created_at desc);
create index stamps_membership_created_idx on stampy_stamps (membership_id, created_at desc);

create table stampy_rewards (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references stampy_tenants(id) on delete cascade,
  membership_id          uuid not null references stampy_memberships(id) on delete cascade,
  program_id             uuid not null references stampy_loyalty_programs(id) on delete restrict,
  status                 reward_status not null default 'earned',
  title                  text not null,
  earned_at              timestamptz not null default now(),
  expires_at             timestamptz,
  redeemed_at            timestamptz,
  redeemed_by_staff      uuid references stampy_staff_users(id) on delete set null,
  redeemed_venue_id      uuid references stampy_venues(id) on delete set null,
  redeem_code            text,
  redeem_code_expires_at timestamptz
);
create index rewards_tenant_status_idx on stampy_rewards (tenant_id, status);
create index rewards_membership_idx on stampy_rewards (membership_id, earned_at desc);
-- A redeem code only has to be unique among codes a cashier can still type in.
create unique index rewards_active_redeem_code on stampy_rewards (tenant_id, redeem_code)
  where status = 'earned' and redeem_code is not null;

-- ------------------------------------------------------------------- nfc ----

create table stampy_nfc_tags (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references stampy_tenants(id) on delete set null,
  venue_id     uuid references stampy_venues(id) on delete set null,
  uid          text not null unique check (uid ~ '^[0-9A-F]{14}$'), -- 7-byte NXP UID, hex
  key_version  smallint not null default 1,
  last_counter integer not null default 0,
  label        text,
  active       boolean not null default true,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now()
);
create index nfc_tags_tenant_idx on stampy_nfc_tags (tenant_id);

alter table stampy_stamps add constraint stamps_tag_fk
  foreign key (tag_id) references stampy_nfc_tags(id) on delete set null;

-- Bridges the browser tap to the Telegram mini app. Single use, short lived.
create table stampy_stamp_tokens (
  token                  text primary key,
  tenant_id              uuid not null references stampy_tenants(id) on delete cascade,
  tag_id                 uuid not null references stampy_nfc_tags(id) on delete cascade,
  venue_id               uuid references stampy_venues(id) on delete set null,
  tap_counter            integer not null,
  created_at             timestamptz not null default now(),
  expires_at             timestamptz not null,
  consumed_at            timestamptz,
  consumed_by_membership uuid references stampy_memberships(id) on delete set null
);
create index stamp_tokens_expiry_idx on stampy_stamp_tokens (expires_at) where consumed_at is null;

-- ------------------------------------------------------------ stampy_broadcasts ----

create table stampy_broadcasts (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references stampy_tenants(id) on delete cascade,
  title        text,
  body         text not null check (length(body) between 1 and 3500),
  image_url    text,
  segment      jsonb not null default '{"type":"all"}'::jsonb,
  button       jsonb,
  status       broadcast_status not null default 'draft',
  scheduled_at timestamptz,
  started_at   timestamptz,
  finished_at  timestamptz,
  sent_count   integer not null default 0,
  failed_count integer not null default 0,
  created_by   uuid references stampy_staff_users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index broadcasts_tenant_idx on stampy_broadcasts (tenant_id, created_at desc);
create index broadcasts_due_idx on stampy_broadcasts (scheduled_at) where status = 'scheduled';
create trigger broadcasts_touch before update on stampy_broadcasts
  for each row execute function public.touch_updated_at();

create table stampy_broadcast_targets (
  id           uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references stampy_broadcasts(id) on delete cascade,
  tenant_id    uuid not null references stampy_tenants(id) on delete cascade,
  customer_id  uuid not null references stampy_customers(id) on delete cascade,
  telegram_id  bigint not null,
  status       delivery_status not null default 'pending',
  error        text,
  attempts     smallint not null default 0,
  sent_at      timestamptz,
  unique (broadcast_id, customer_id)
);
create index broadcast_targets_pending_idx on stampy_broadcast_targets (broadcast_id) where status = 'pending';

create table stampy_kit_orders (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references stampy_tenants(id) on delete cascade,
  venue_id     uuid references stampy_venues(id) on delete set null,
  contact_name text not null,
  phone        text not null,
  address      text not null,
  note         text,
  status       kit_status not null default 'requested',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index kit_orders_status_idx on stampy_kit_orders (status, created_at);
create trigger kit_orders_touch before update on stampy_kit_orders
  for each row execute function public.touch_updated_at();
