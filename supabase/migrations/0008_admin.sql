-- Platform operations. Staff hold column-level UPDATE on presentation fields
-- only, so billing and tag provisioning run through these checked functions.

create or replace function public.admin_set_subscription(
  p_tenant uuid,
  p_status subscription_status,
  p_plan   tenant_plan,
  p_until  timestamptz default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update tenants
     set subscription_status = p_status,
         plan = p_plan,
         subscription_until = p_until
   where id = p_tenant;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- Called once per physical tag, after it has been programmed with its keys.
create or replace function public.admin_register_tag(
  p_uid    text,
  p_tenant uuid default null,
  p_venue  uuid default null,
  p_label  text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid text := upper(trim(p_uid));
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_uid !~ '^[0-9A-F]{14}$' then
    return jsonb_build_object('ok', false, 'code', 'bad_uid');
  end if;

  insert into nfc_tags (uid, tenant_id, venue_id, label)
  values (v_uid, p_tenant, p_venue, p_label)
  on conflict (uid) do update
    set tenant_id = excluded.tenant_id,
        venue_id  = excluded.venue_id,
        label     = coalesce(excluded.label, nfc_tags.label),
        active    = true;

  return jsonb_build_object('ok', true, 'uid', v_uid);
end $$;

create or replace function public.admin_set_kit_status(p_kit uuid, p_status kit_status)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update kit_orders set status = p_status where id = p_kit;
  return jsonb_build_object('ok', found);
end $$;

-- One row per shop for the platform overview.
create or replace function public.admin_tenant_summary()
returns table (
  id uuid, name text, slug text, plan tenant_plan,
  subscription_status subscription_status, trial_ends_at timestamptz,
  subscription_until timestamptz, customers bigint, stamps_30d bigint, tags bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select t.id, t.name, t.slug, t.plan, t.subscription_status, t.trial_ends_at, t.subscription_until,
         (select count(*) from memberships m where m.tenant_id = t.id),
         (select count(*) from stamps s where s.tenant_id = t.id and s.created_at > now() - interval '30 days'),
         (select count(*) from nfc_tags n where n.tenant_id = t.id)
  from tenants t
  order by t.created_at desc;
end $$;

grant execute on function public.admin_set_subscription(uuid, subscription_status, tenant_plan, timestamptz) to authenticated;
grant execute on function public.admin_register_tag(text, uuid, uuid, text) to authenticated;
grant execute on function public.admin_set_kit_status(uuid, kit_status) to authenticated;
grant execute on function public.admin_tenant_summary() to authenticated;
