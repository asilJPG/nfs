-- Затыкаем MEDIUM/LOW-находки аудита.

-- 1) redeem_reward: p_venue должен принадлежать той же кофейне
create or replace function public.redeem_reward(
  p_tenant uuid,
  p_code   text,
  p_venue  uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_reward stampy_rewards;
  v_name   text;
begin
  if not public.can_read_tenant(p_tenant) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_venue is not null and not exists (
    select 1 from stampy_venues where id = p_venue and tenant_id = p_tenant
  ) then
    return jsonb_build_object('ok', false, 'code', 'venue_mismatch');
  end if;

  select r.* into v_reward from stampy_rewards r
  where r.tenant_id = p_tenant
    and r.redeem_code = trim(p_code)
    and r.status = 'earned'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_reward.redeem_code_expires_at is null or v_reward.redeem_code_expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'code_expired');
  end if;
  if v_reward.expires_at is not null and v_reward.expires_at <= now() then
    update stampy_rewards set status = 'expired' where id = v_reward.id;
    return jsonb_build_object('ok', false, 'code', 'reward_expired');
  end if;

  update stampy_rewards
     set status = 'redeemed',
         redeemed_at = now(),
         redeemed_by_staff = public.staff_id(),
         redeemed_venue_id = p_venue,
         redeem_code = null,
         redeem_code_expires_at = null
   where id = v_reward.id;

  select coalesce(c.first_name, 'Гость') into v_name
  from stampy_memberships m join stampy_customers c on c.id = m.customer_id
  where m.id = v_reward.membership_id;

  return jsonb_build_object('ok', true, 'title', v_reward.title, 'customer', v_name);
end $$;

-- 2) gen_code на CSPRNG (через gen_random_uuid) вместо random(). Используется в public_code карт.
create or replace function public.gen_code(len int, alphabet text default '23456789ABCDEFGHJKMNPQRSTUVWXYZ')
returns text language plpgsql volatile as $$
declare
  out_code text := '';
  alpha_len int := length(alphabet);
  hex_pool text := '';
  i int;
  byte_val int;
begin
  -- gen_random_uuid v4 использует CSPRNG; собираем достаточно hex-байт под запрошенную длину
  while length(hex_pool) < len * 2 loop
    hex_pool := hex_pool || replace(gen_random_uuid()::text, '-', '');
  end loop;
  for i in 0..len-1 loop
    byte_val := ('x' || substr(hex_pool, i * 2 + 1, 2))::bit(8)::int;
    out_code := out_code || substr(alphabet, (byte_val % alpha_len) + 1, 1);
  end loop;
  return out_code;
end $$;

-- 3) Явно ограничиваем EXECUTE админ-функций — если внутренняя проверка когда-нибудь сломается,
--    хотя бы гейт по роли останется.
revoke execute on function public.admin_set_application_status(uuid, text) from public, anon;
grant execute on function public.admin_set_application_status(uuid, text) to authenticated;

revoke execute on function public.admin_create_tenant(uuid, text, text, text, text, jsonb, int, text) from public, anon;
grant execute on function public.admin_create_tenant(uuid, text, text, text, text, jsonb, int, text) to authenticated;

revoke execute on function public.admin_update_tenant(uuid, text, text) from public, anon;
grant execute on function public.admin_update_tenant(uuid, text, text) to authenticated;

revoke execute on function public.admin_delete_tenant(uuid) from public, anon;
grant execute on function public.admin_delete_tenant(uuid) to authenticated;

revoke execute on function public.admin_delete_tag(text) from public, anon;
grant execute on function public.admin_delete_tag(text) to authenticated;

revoke execute on function public.admin_tenant_owner(uuid) from public, anon;
grant execute on function public.admin_tenant_owner(uuid) to authenticated;

-- 4) expire_stale: чистим одноразовые stamp-токены агрессивнее (TTL и так 3 мин, 2 суток избыточно)
create or replace function public.expire_stale()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_rewards int;
  v_tokens  int;
begin
  update stampy_rewards set status = 'expired'
   where status = 'earned' and expires_at is not null and expires_at <= now();
  get diagnostics v_rewards = row_count;

  delete from stampy_stamp_tokens where expires_at < now() - interval '1 hour';
  get diagnostics v_tokens = row_count;

  return jsonb_build_object('expired_rewards', v_rewards, 'deleted_tokens', v_tokens);
end $$;
