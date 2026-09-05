-- Тайлы для /admin — счётчики платформы одним запросом.
create or replace function public.admin_platform_overview()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tashkent text := 'Asia/Tashkent';
  v_today_start timestamptz := date_trunc('day', now() at time zone v_tashkent) at time zone v_tashkent;
  v_week_start  timestamptz := v_today_start - interval '7 days';
  v_month_start timestamptz := v_today_start - interval '30 days';
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
    'tags_unassigned',  (select count(*) from stampy_nfc_tags where tenant_id is null)
  );
end $$;

revoke execute on function public.admin_platform_overview() from public, anon;
grant execute on function public.admin_platform_overview() to authenticated;

-- Список гостей с агрегатами: сколько карт, штампов, дата активности.
create or replace function public.admin_guests_search(p_query text default null, p_limit int default 100)
returns table (
  id uuid,
  telegram_id bigint,
  first_name text,
  last_name text,
  username text,
  can_message boolean,
  blocked_at timestamptz,
  created_at timestamptz,
  cards_count int,
  stamps_count int,
  rewards_earned int,
  last_stamp_at timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    c.id, c.telegram_id, c.first_name, c.last_name, c.username, c.can_message, c.blocked_at, c.created_at,
    (select count(*)::int from stampy_memberships m where m.customer_id = c.id) as cards_count,
    (select count(*)::int from stampy_stamps s
       join stampy_memberships m on m.id = s.membership_id
       where m.customer_id = c.id) as stamps_count,
    (select count(*)::int from stampy_rewards r
       join stampy_memberships m on m.id = r.membership_id
       where m.customer_id = c.id) as rewards_earned,
    (select max(s.created_at) from stampy_stamps s
       join stampy_memberships m on m.id = s.membership_id
       where m.customer_id = c.id) as last_stamp_at
  from stampy_customers c
  where p_query is null
    or c.telegram_id::text = p_query
    or c.username ilike '%' || p_query || '%'
    or c.first_name ilike '%' || p_query || '%'
    or c.last_name ilike '%' || p_query || '%'
  order by
    case when p_query is null then null else c.created_at end desc nulls last,
    (select max(s.created_at) from stampy_stamps s
       join stampy_memberships m on m.id = s.membership_id
       where m.customer_id = c.id) desc nulls last
  limit greatest(1, least(500, p_limit));
end $$;

revoke execute on function public.admin_guests_search(text, int) from public, anon;
grant execute on function public.admin_guests_search(text, int) to authenticated;

create or replace function public.admin_guest_detail(p_customer uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_customer stampy_customers;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_customer from stampy_customers where id = p_customer;
  if not found then return jsonb_build_object('error', 'not_found'); end if;

  return jsonb_build_object(
    'customer', row_to_json(v_customer),
    'cards', (
      select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) from (
        select t.name as tenant_name, t.slug, m.stamps_count, m.lifetime_stamps, m.last_stamp_at,
               (select count(*) from stampy_rewards r where r.membership_id = m.id) as rewards_total,
               (select count(*) from stampy_rewards r where r.membership_id = m.id and r.status = 'earned') as rewards_earned
        from stampy_memberships m
        join stampy_tenants t on t.id = m.tenant_id
        where m.customer_id = p_customer
        order by m.last_stamp_at desc nulls last
      ) x
    ),
    'recent_stamps', (
      select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) from (
        select s.created_at, s.source, t.name as tenant_name, v.name as venue_name
        from stampy_stamps s
        join stampy_memberships m on m.id = s.membership_id
        join stampy_tenants t on t.id = s.tenant_id
        left join stampy_venues v on v.id = s.venue_id
        where m.customer_id = p_customer
        order by s.created_at desc
        limit 50
      ) x
    )
  );
end $$;

revoke execute on function public.admin_guest_detail(uuid) from public, anon;
grant execute on function public.admin_guest_detail(uuid) to authenticated;

create or replace function public.admin_set_guest_blocked(p_customer uuid, p_blocked boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update stampy_customers
     set can_message = not p_blocked,
         blocked_at = case when p_blocked then now() else null end
   where id = p_customer;
end $$;

revoke execute on function public.admin_set_guest_blocked(uuid, boolean) from public, anon;
grant execute on function public.admin_set_guest_blocked(uuid, boolean) to authenticated;
