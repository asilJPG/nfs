-- Реальные деньги и реальные ряды для тайлов /admin.
-- Цены держать в синке с PLAN_PRICE_UZS в lib/plan.ts.
create or replace function public.admin_plan_price_uzs(p_plan text)
returns bigint language sql immutable set search_path = public as $$
  select case p_plan when 'marketing' then 490000::bigint else 290000::bigint end;
$$;

create or replace function public.admin_platform_overview()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tashkent text := 'Asia/Tashkent';
  v_today_start timestamptz := date_trunc('day', now() at time zone v_tashkent) at time zone v_tashkent;
  v_week_start  timestamptz := v_today_start - interval '7 days';
  v_month_start timestamptz := v_today_start - interval '30 days';
  v_series_start timestamptz := v_today_start - interval '13 days';
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'tenants_total',    (select count(*) from stampy_tenants),
    'tenants_active',   (select count(*) from stampy_tenants where subscription_status in ('trial', 'active')),
    'tenants_paying',   (select count(*) from stampy_tenants where subscription_status = 'active'),
    'tenants_new_week', (select count(*) from stampy_tenants where created_at >= v_week_start),
    'guests_total',     (select count(*) from stampy_customers),
    'guests_active_month', (select count(distinct m.customer_id) from stampy_stamps s
                             join stampy_memberships m on m.id = s.membership_id
                             where s.created_at >= v_month_start),
    'stamps_today',     (select count(*) from stampy_stamps where created_at >= v_today_start),
    'stamps_week',      (select count(*) from stampy_stamps where created_at >= v_week_start),
    'rewards_redeemed_week', (select count(*) from stampy_rewards where status = 'redeemed' and redeemed_at >= v_week_start),
    'applications_open',(select count(*) from stampy_applications where status in ('new', 'contacted')),
    'tags_total',       (select count(*) from stampy_nfc_tags),
    'tags_unassigned',  (select count(*) from stampy_nfc_tags where tenant_id is null),

    -- MRR: сумма прайса по тарифам платящих кофеен
    'mrr_uzs', (
      select coalesce(sum(public.admin_plan_price_uzs(t.plan)), 0)
      from stampy_tenants t
      where t.subscription_status = 'active'
    ),
    'mrr_new_week_uzs', (
      select coalesce(sum(public.admin_plan_price_uzs(t.plan)), 0)
      from stampy_tenants t
      where t.subscription_status = 'active' and t.created_at >= v_week_start
    ),

    -- Ряды за 14 дней для спарклайнов (индекс 0 — самый старый день)
    'series_stamps', (
      select coalesce(jsonb_agg(d.n order by d.day), '[]'::jsonb) from (
        select g.day, (select count(*) from stampy_stamps s
                       where s.created_at >= g.day and s.created_at < g.day + interval '1 day') as n
        from generate_series(v_series_start, v_today_start, interval '1 day') as g(day)
      ) d
    ),
    'series_tenants', (
      select coalesce(jsonb_agg(d.n order by d.day), '[]'::jsonb) from (
        select g.day, (select count(*) from stampy_tenants t
                       where t.created_at < g.day + interval '1 day') as n
        from generate_series(v_series_start, v_today_start, interval '1 day') as g(day)
      ) d
    ),
    'series_guests', (
      select coalesce(jsonb_agg(d.n order by d.day), '[]'::jsonb) from (
        select g.day, (select count(*) from stampy_customers c
                       where c.created_at < g.day + interval '1 day') as n
        from generate_series(v_series_start, v_today_start, interval '1 day') as g(day)
      ) d
    ),
    'series_applications', (
      select coalesce(jsonb_agg(d.n order by d.day), '[]'::jsonb) from (
        select g.day, (select count(*) from stampy_applications a
                       where a.created_at >= g.day and a.created_at < g.day + interval '1 day') as n
        from generate_series(v_series_start, v_today_start, interval '1 day') as g(day)
      ) d
    )
  );
end $$;

revoke execute on function public.admin_platform_overview() from public, anon;
grant execute on function public.admin_platform_overview() to authenticated;
