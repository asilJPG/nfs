-- Платформенный админ создаёт кофейню по заявке: делает то же, что create_tenant,
-- но от лица указанного auth-пользователя, а не auth.uid().
create or replace function public.admin_create_tenant(
  p_owner_auth_user uuid,
  p_name            text,
  p_slug            text,
  p_username        text,
  p_venue_name      text default null,
  p_brand           jsonb default null,
  p_stamps          int default 6,
  p_reward          text default 'Бесплатный кофе'
)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_email  text;
  v_tenant stampy_tenants;
  v_venue  stampy_venues;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from stampy_staff_users where auth_user_id = p_owner_auth_user) then
    return jsonb_build_object('ok', false, 'code', 'already_has_tenant');
  end if;
  if exists (select 1 from stampy_tenants where slug = lower(trim(p_slug))) then
    return jsonb_build_object('ok', false, 'code', 'slug_taken');
  end if;
  if exists (select 1 from stampy_staff_users where username = lower(trim(p_username))) then
    return jsonb_build_object('ok', false, 'code', 'username_taken');
  end if;

  select email into v_email from auth.users where id = p_owner_auth_user;
  if v_email is null then
    return jsonb_build_object('ok', false, 'code', 'user_not_found');
  end if;

  insert into stampy_tenants (slug, name, brand)
  values (lower(trim(p_slug)), trim(p_name), coalesce(p_brand, public.default_brand()))
  returning * into v_tenant;

  insert into stampy_venues (tenant_id, name)
  values (v_tenant.id, coalesce(nullif(trim(p_venue_name), ''), trim(p_name)))
  returning * into v_venue;

  insert into stampy_loyalty_programs (tenant_id, stamps_required, reward_title)
  values (v_tenant.id, greatest(2, least(20, p_stamps)), trim(p_reward));

  insert into stampy_staff_users (tenant_id, auth_user_id, email, username, role)
  values (v_tenant.id, p_owner_auth_user, v_email, lower(trim(p_username)), 'owner');

  return jsonb_build_object('ok', true, 'tenant_id', v_tenant.id, 'slug', v_tenant.slug,
                            'venue_id', v_venue.id, 'trial_ends_at', v_tenant.trial_ends_at);
end $$;
