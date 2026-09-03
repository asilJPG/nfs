-- Self-serve signup, audience segments and the dashboard's analytics queries.
-- All of these are SECURITY DEFINER + an explicit permission check, so the shop
-- gets exactly its own numbers and nothing else.

-- Creates the tenant, its first venue, its card and the owner account in one go.
create or replace function public.create_tenant(
  p_name       text,
  p_slug       text,
  p_venue_name text default null,
  p_brand      jsonb default null,
  p_stamps     int default 6,
  p_reward     text default 'Бесплатный кофе'
)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_tenant stampy_tenants;
  v_venue  stampy_venues;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from stampy_staff_users where auth_user_id = v_uid) then
    return jsonb_build_object('ok', false, 'code', 'already_has_tenant');
  end if;
  if exists (select 1 from stampy_tenants where slug = lower(trim(p_slug))) then
    return jsonb_build_object('ok', false, 'code', 'slug_taken');
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into stampy_tenants (slug, name, brand)
  values (lower(trim(p_slug)), trim(p_name), coalesce(p_brand, public.default_brand()))
  returning * into v_tenant;

  insert into stampy_venues (tenant_id, name)
  values (v_tenant.id, coalesce(nullif(trim(p_venue_name), ''), trim(p_name)))
  returning * into v_venue;

  insert into stampy_loyalty_programs (tenant_id, stamps_required, reward_title)
  values (v_tenant.id, greatest(2, least(20, p_stamps)), trim(p_reward));

  insert into stampy_staff_users (tenant_id, auth_user_id, email, role)
  values (v_tenant.id, v_uid, v_email, 'owner');

  return jsonb_build_object('ok', true, 'tenant_id', v_tenant.id, 'slug', v_tenant.slug,
                            'venue_id', v_venue.id, 'trial_ends_at', v_tenant.trial_ends_at);
end $$;

create or replace function public.default_brand()
returns jsonb language sql immutable as $$
  select '{"primary":"#6F4E37","bg":"#FFF8F0","surface":"#FFFFFF","text":"#2A1E17","accent":"#C8A27A","card_style":"circles"}'::jsonb
$$;

grant execute on function public.create_tenant(text, text, text, jsonb, int, text) to authenticated;
grant execute on function public.default_brand() to authenticated;

-- ------------------------------------------------------------- segments -----
-- segment shapes:
--   {"type":"all"}
--   {"type":"inactive","days":14}
--   {"type":"close_to_reward","remaining":1}
--   {"type":"has_reward"}
--   {"type":"new","days":7}

create or replace function public.segment_customers(p_tenant uuid, p_segment jsonb)
returns table (customer_id uuid, telegram_id bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_type      text := coalesce(p_segment ->> 'type', 'all');
  v_days      int  := coalesce((p_segment ->> 'days')::int, 14);
  v_remaining int  := coalesce((p_segment ->> 'remaining')::int, 1);
  v_required  int;
begin
  if not public.can_read_tenant(p_tenant) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select stamps_required into v_required from stampy_loyalty_programs
  where tenant_id = p_tenant and active;

  return query
  select c.id, c.telegram_id
  from stampy_memberships m
  join stampy_customers c on c.id = m.customer_id
  where m.tenant_id = p_tenant
    and c.can_message
    and case v_type
      when 'all' then true
      when 'inactive' then
        m.last_stamp_at is not null
        and m.last_stamp_at < now() - make_interval(days => v_days)
      when 'new' then
        m.first_seen_at >= now() - make_interval(days => v_days)
      when 'close_to_reward' then
        v_required is not null and m.stamps_count >= v_required - v_remaining
                               and m.stamps_count < v_required
      when 'has_reward' then
        exists (select 1 from stampy_rewards r where r.membership_id = m.id and r.status = 'earned')
      else false
    end;
end $$;

grant execute on function public.segment_customers(uuid, jsonb) to authenticated;

-- ------------------------------------------------------------ analytics -----

create or replace function public.analytics_overview(
  p_tenant uuid, p_from timestamptz, p_to timestamptz
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if not public.can_read_tenant(p_tenant) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'stamps', (select count(*) from stampy_stamps s
                where s.tenant_id = p_tenant and s.created_at >= p_from and s.created_at < p_to),
    'unique_visitors', (select count(distinct s.membership_id) from stampy_stamps s
                where s.tenant_id = p_tenant and s.created_at >= p_from and s.created_at < p_to),
    'new_customers', (select count(*) from stampy_memberships m
                where m.tenant_id = p_tenant and m.first_seen_at >= p_from and m.first_seen_at < p_to),
    'active_cards', (select count(*) from stampy_memberships m
                where m.tenant_id = p_tenant and m.last_stamp_at >= now() - interval '60 days'),
    'total_cards', (select count(*) from stampy_memberships m where m.tenant_id = p_tenant),
    'rewards_earned', (select count(*) from stampy_rewards r
                where r.tenant_id = p_tenant and r.earned_at >= p_from and r.earned_at < p_to),
    'rewards_redeemed', (select count(*) from stampy_rewards r
                where r.tenant_id = p_tenant and r.redeemed_at >= p_from and r.redeemed_at < p_to),
    'rewards_outstanding', (select count(*) from stampy_rewards r
                where r.tenant_id = p_tenant and r.status = 'earned')
  ) into v;
  return v;
end $$;

create or replace function public.analytics_daily(
  p_tenant uuid, p_from timestamptz, p_to timestamptz, p_tz text default 'Asia/Tashkent'
)
returns table (day date, stamps bigint, new_customers bigint, returning_customers bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_read_tenant(p_tenant) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  with days as (
    select generate_series(
      (p_from at time zone p_tz)::date,
      (p_to   at time zone p_tz)::date - 1,
      interval '1 day'
    )::date as day
  ),
  visits as (
    select (s.created_at at time zone p_tz)::date as day,
           s.membership_id,
           m.first_seen_at
    from stampy_stamps s
    join stampy_memberships m on m.id = s.membership_id
    where s.tenant_id = p_tenant and s.created_at >= p_from and s.created_at < p_to
  )
  select d.day,
         (select count(*) from visits v where v.day = d.day),
         (select count(*) from stampy_memberships m
           where m.tenant_id = p_tenant
             and (m.first_seen_at at time zone p_tz)::date = d.day),
         (select count(distinct v.membership_id) from visits v
           where v.day = d.day
             and (v.first_seen_at at time zone p_tz)::date < d.day)
  from days d
  order by d.day;
end $$;

-- Which hours actually bring people in. dow: 0 = Sunday.
create or replace function public.analytics_heatmap(
  p_tenant uuid, p_from timestamptz, p_to timestamptz, p_tz text default 'Asia/Tashkent'
)
returns table (dow int, hour int, stamps bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_read_tenant(p_tenant) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select extract(dow from s.created_at at time zone p_tz)::int,
         extract(hour from s.created_at at time zone p_tz)::int,
         count(*)
  from stampy_stamps s
  where s.tenant_id = p_tenant and s.created_at >= p_from and s.created_at < p_to
  group by 1, 2
  order by 1, 2;
end $$;

-- Monthly cohorts: of the people who joined in month X, how many came back N months later.
create or replace function public.analytics_cohorts(
  p_tenant uuid, p_months int default 6, p_tz text default 'Asia/Tashkent'
)
returns table (cohort date, cohort_size bigint, month_offset int, retained bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_read_tenant(p_tenant) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  with base as (
    select m.id,
           date_trunc('month', m.first_seen_at at time zone p_tz)::date as cohort
    from stampy_memberships m
    where m.tenant_id = p_tenant
      and m.first_seen_at >= date_trunc('month', now() at time zone p_tz)
                             - make_interval(months => p_months - 1)
  ),
  sizes as (select b.cohort, count(*) as cohort_size from base b group by b.cohort),
  activity as (
    select distinct b.cohort,
           b.id,
           (extract(year from age(
              date_trunc('month', s.created_at at time zone p_tz),
              b.cohort::timestamp)) * 12
            + extract(month from age(
              date_trunc('month', s.created_at at time zone p_tz),
              b.cohort::timestamp)))::int as month_offset
    from base b
    join stampy_stamps s on s.membership_id = b.id
    where s.tenant_id = p_tenant
  )
  select s.cohort, s.cohort_size, a.month_offset, count(distinct a.id)
  from sizes s
  join activity a on a.cohort = s.cohort
  group by s.cohort, s.cohort_size, a.month_offset
  order by s.cohort, a.month_offset;
end $$;

grant execute on function public.analytics_overview(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.analytics_daily(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.analytics_heatmap(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.analytics_cohorts(uuid, int, text) to authenticated;
