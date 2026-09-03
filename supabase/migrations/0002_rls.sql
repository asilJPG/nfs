-- Row level security.
--
-- Two principals reach Postgres directly:
--   * `authenticated` — coffee shop staff and platform admins (Supabase Auth).
--   * `service_role`  — our API routes acting for mini-app customers. Bypasses RLS.
-- `anon` gets nothing: the mini app never talks to PostgREST from the browser.
--
-- The helper functions are SECURITY DEFINER so a policy on staff_users can read
-- staff_users without recursing through its own policy.

create or replace function public.staff_tenant_id()
returns uuid language sql stable security definer set search_path = public, auth as $$
  select tenant_id from staff_users
  where auth_user_id = auth.uid() and active
  limit 1
$$;

create or replace function public.staff_role()
returns staff_role language sql stable security definer set search_path = public, auth as $$
  select role from staff_users
  where auth_user_id = auth.uid() and active
  limit 1
$$;

create or replace function public.staff_id()
returns uuid language sql stable security definer set search_path = public, auth as $$
  select id from staff_users
  where auth_user_id = auth.uid() and active
  limit 1
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from platform_admins where auth_user_id = auth.uid())
$$;

-- True for the tenant the caller works for, or for anything when they run the platform.
create or replace function public.can_read_tenant(target uuid)
returns boolean language sql stable set search_path = public as $$
  select public.is_platform_admin() or target = public.staff_tenant_id()
$$;

-- Managing a tenant means being its owner or manager (cashiers only ring people up).
create or replace function public.can_manage_tenant(target uuid)
returns boolean language sql stable set search_path = public as $$
  select public.is_platform_admin()
      or (target = public.staff_tenant_id() and public.staff_role() in ('owner', 'manager'))
$$;

revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;

alter table tenants           enable row level security;
alter table platform_admins   enable row level security;
alter table venues            enable row level security;
alter table staff_users       enable row level security;
alter table loyalty_programs  enable row level security;
alter table customers         enable row level security;
alter table memberships       enable row level security;
alter table stamps            enable row level security;
alter table rewards           enable row level security;
alter table nfc_tags          enable row level security;
alter table stamp_tokens      enable row level security;
alter table broadcasts        enable row level security;
alter table broadcast_targets enable row level security;
alter table kit_orders        enable row level security;

-- --------------------------------------------------------------- tenants ----
-- Plan and subscription columns are ours to set, so staff get column-level UPDATE
-- on presentation fields only. A tenant is created by the signup RPC, never directly.

create policy tenants_read on tenants for select to authenticated
  using (public.can_read_tenant(id));
create policy tenants_update on tenants for update to authenticated
  using (public.can_manage_tenant(id)) with check (public.can_manage_tenant(id));

revoke update on tenants from authenticated;
grant update (name, logo_url, brand) on tenants to authenticated;

create policy platform_admins_read on platform_admins for select to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------- venues ----

create policy venues_read on venues for select to authenticated
  using (public.can_read_tenant(tenant_id));
create policy venues_write on venues for all to authenticated
  using (public.can_manage_tenant(tenant_id)) with check (public.can_manage_tenant(tenant_id));

-- ----------------------------------------------------------------- staff ----

create policy staff_read on staff_users for select to authenticated
  using (public.can_read_tenant(tenant_id));
-- Managers run the team, but only an owner (or we) may touch an owner row —
-- otherwise a manager could demote the person who hired them.
create policy staff_write on staff_users for all to authenticated
  using (
    public.can_manage_tenant(tenant_id)
    and (role <> 'owner' or public.staff_role() = 'owner' or public.is_platform_admin())
  )
  with check (
    public.can_manage_tenant(tenant_id)
    and (role <> 'owner' or public.staff_role() = 'owner' or public.is_platform_admin())
  );

-- --------------------------------------------------------------- program ----

create policy programs_read on loyalty_programs for select to authenticated
  using (public.can_read_tenant(tenant_id));
create policy programs_write on loyalty_programs for all to authenticated
  using (public.can_manage_tenant(tenant_id)) with check (public.can_manage_tenant(tenant_id));

-- ------------------------------------------------------------- customers ----
-- Staff see a customer only through a membership in their own tenant.

create policy customers_read on customers for select to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from memberships m
      where m.customer_id = customers.id and m.tenant_id = public.staff_tenant_id()
    )
  );

create policy memberships_read on memberships for select to authenticated
  using (public.can_read_tenant(tenant_id));
create policy stamps_read on stamps for select to authenticated
  using (public.can_read_tenant(tenant_id));
create policy rewards_read on rewards for select to authenticated
  using (public.can_read_tenant(tenant_id));

-- Stamps and rewards are only ever written through SECURITY DEFINER functions
-- (claim_stamp, add_manual_stamp, redeem_reward), so no write policies here.

-- ------------------------------------------------------------------- nfc ----
-- Tags are provisioned by the platform; a shop may only place and disable them.

create policy nfc_tags_read on nfc_tags for select to authenticated
  using (public.can_read_tenant(tenant_id));
create policy nfc_tags_update on nfc_tags for update to authenticated
  using (public.can_manage_tenant(tenant_id)) with check (public.can_manage_tenant(tenant_id));
create policy nfc_tags_admin on nfc_tags for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

revoke update on nfc_tags from authenticated;
grant update (venue_id, label, active) on nfc_tags to authenticated;

-- stamp_tokens: service role only. No policies at all.

-- ------------------------------------------------------------ broadcasts ----

create policy broadcasts_read on broadcasts for select to authenticated
  using (public.can_read_tenant(tenant_id));
create policy broadcasts_write on broadcasts for all to authenticated
  using (public.can_manage_tenant(tenant_id)) with check (public.can_manage_tenant(tenant_id));
create policy broadcast_targets_read on broadcast_targets for select to authenticated
  using (public.can_read_tenant(tenant_id));

-- ------------------------------------------------------------ kit orders ----

create policy kit_orders_read on kit_orders for select to authenticated
  using (public.can_read_tenant(tenant_id));
create policy kit_orders_insert on kit_orders for insert to authenticated
  with check (public.can_manage_tenant(tenant_id));
create policy kit_orders_admin on kit_orders for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
