-- Business logic that must be atomic lives here, not in the API layer.
-- Everything that touches stampy_stamps or stampy_rewards goes through these functions.

-- Codes people read aloud or type: no 0/O/1/I/L confusion.
create or replace function public.gen_code(len int, alphabet text default '23456789ABCDEFGHJKMNPQRSTUVWXYZ')
returns text language plpgsql volatile as $$
declare
  out_code text := '';
  i int;
begin
  for i in 1..len loop
    out_code := out_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return out_code;
end $$;

-- Is this tenant allowed to hand out stampy_stamps right now?
create or replace function public.tenant_is_serving(t stampy_tenants)
returns boolean language sql immutable as $$
  select case t.subscription_status
    when 'trial'  then t.trial_ends_at > now()
    when 'active' then t.subscription_until is null or t.subscription_until > now()
    else false
  end
$$;

-- Finds or creates the customer + their card for this tenant. Service role only.
create or replace function public.ensure_membership(
  p_tenant      uuid,
  p_telegram_id bigint,
  p_profile     jsonb default '{}'::jsonb
)
returns stampy_memberships language plpgsql security definer set search_path = public as $$
declare
  v_customer   stampy_customers;
  v_membership stampy_memberships;
  v_attempt    int := 0;
begin
  insert into stampy_customers (telegram_id, first_name, last_name, username, photo_url, language_code)
  values (
    p_telegram_id,
    nullif(p_profile ->> 'first_name', ''),
    nullif(p_profile ->> 'last_name', ''),
    nullif(p_profile ->> 'username', ''),
    nullif(p_profile ->> 'photo_url', ''),
    nullif(p_profile ->> 'language_code', '')
  )
  on conflict (telegram_id) do update
    set first_name    = coalesce(excluded.first_name, stampy_customers.first_name),
        last_name     = coalesce(excluded.last_name, stampy_customers.last_name),
        username      = excluded.username,
        photo_url     = coalesce(excluded.photo_url, stampy_customers.photo_url),
        language_code = coalesce(excluded.language_code, stampy_customers.language_code)
  returning * into v_customer;

  select * into v_membership from stampy_memberships
  where tenant_id = p_tenant and customer_id = v_customer.id;
  if found then
    return v_membership;
  end if;

  -- public_code is unique per tenant; retry on the rare collision.
  loop
    v_attempt := v_attempt + 1;
    begin
      insert into stampy_memberships (tenant_id, customer_id, public_code)
      values (p_tenant, v_customer.id, public.gen_code(6))
      returning * into v_membership;
      return v_membership;
    exception when unique_violation then
      if v_attempt >= 5 then raise; end if;
    end;
  end loop;
end $$;

-- Core write path: a validated NFC tap turns into one stamp, maybe a reward.
-- The token row is locked first, which is what makes a double tap harmless.
create or replace function public.claim_stamp(
  p_token       text,
  p_telegram_id bigint,
  p_profile     jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_token      stampy_stamp_tokens;
  v_tenant     stampy_tenants;
  v_program    stampy_loyalty_programs;
  v_membership stampy_memberships;
  v_reward     stampy_rewards;
  v_wait_secs  int;
begin
  select * into v_token from stampy_stamp_tokens where token = p_token for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'token_unknown');
  end if;
  if v_token.consumed_at is not null then
    return jsonb_build_object('ok', false, 'code', 'token_used');
  end if;
  if v_token.expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'token_expired');
  end if;

  select * into v_tenant from stampy_tenants where id = v_token.tenant_id;
  if not public.tenant_is_serving(v_tenant) then
    return jsonb_build_object('ok', false, 'code', 'tenant_inactive');
  end if;

  select * into v_program from stampy_loyalty_programs
  where tenant_id = v_tenant.id and active;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_program');
  end if;

  v_membership := public.ensure_membership(v_tenant.id, p_telegram_id, p_profile);

  -- Burn the token either way: the tap physically happened.
  update stampy_stamp_tokens
     set consumed_at = now(), consumed_by_membership = v_membership.id
   where token = p_token;

  if v_membership.last_stamp_at is not null
     and v_membership.last_stamp_at + make_interval(mins => v_program.stamp_cooldown_minutes) > now()
  then
    v_wait_secs := ceil(extract(epoch from
      v_membership.last_stamp_at + make_interval(mins => v_program.stamp_cooldown_minutes) - now()));
    return jsonb_build_object(
      'ok', false, 'code', 'cooldown',
      'retry_after_seconds', v_wait_secs,
      'stamps_count', v_membership.stamps_count,
      'stamps_required', v_program.stamps_required
    );
  end if;

  insert into stampy_stamps (tenant_id, membership_id, venue_id, tag_id, source)
  values (v_tenant.id, v_membership.id, v_token.venue_id, v_token.tag_id, 'nfc');

  update stampy_memberships
     set stamps_count    = stamps_count + 1,
         lifetime_stamps = lifetime_stamps + 1,
         last_stamp_at   = now()
   where id = v_membership.id
  returning * into v_membership;

  if v_membership.stamps_count >= v_program.stamps_required then
    update stampy_memberships
       set stamps_count = stamps_count - v_program.stamps_required
     where id = v_membership.id
    returning * into v_membership;

    insert into stampy_rewards (tenant_id, membership_id, program_id, title, expires_at)
    values (
      v_tenant.id, v_membership.id, v_program.id, v_program.reward_title,
      case when v_program.reward_expires_days is null then null
           else now() + make_interval(days => v_program.reward_expires_days) end
    )
    returning * into v_reward;
  end if;

  return jsonb_build_object(
    'ok', true,
    'membership_id', v_membership.id,
    'stamps_count', v_membership.stamps_count,
    'stamps_required', v_program.stamps_required,
    'lifetime_stamps', v_membership.lifetime_stamps,
    'reward', case when v_reward.id is null then null else to_jsonb(v_reward) end
  );
end $$;

-- Manual stamp from the cashier screen, for when a tag or a phone misbehaves.
create or replace function public.add_manual_stamp(
  p_tenant      uuid,
  p_public_code text,
  p_venue       uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tenant     stampy_tenants;
  v_program    stampy_loyalty_programs;
  v_membership stampy_memberships;
  v_reward     stampy_rewards;
  v_staff      uuid := public.staff_id();
begin
  if not public.can_read_tenant(p_tenant) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_tenant from stampy_tenants where id = p_tenant;
  if not public.tenant_is_serving(v_tenant) then
    return jsonb_build_object('ok', false, 'code', 'tenant_inactive');
  end if;

  select * into v_program from stampy_loyalty_programs where tenant_id = p_tenant and active;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'no_program');
  end if;

  select * into v_membership from stampy_memberships
  where tenant_id = p_tenant and public_code = upper(trim(p_public_code))
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'card_not_found');
  end if;

  insert into stampy_stamps (tenant_id, membership_id, venue_id, source, staff_user_id)
  values (p_tenant, v_membership.id, p_venue, 'manual', v_staff);

  update stampy_memberships
     set stamps_count    = stamps_count + 1,
         lifetime_stamps = lifetime_stamps + 1,
         last_stamp_at   = now()
   where id = v_membership.id
  returning * into v_membership;

  if v_membership.stamps_count >= v_program.stamps_required then
    update stampy_memberships set stamps_count = stamps_count - v_program.stamps_required
     where id = v_membership.id
    returning * into v_membership;

    insert into stampy_rewards (tenant_id, membership_id, program_id, title, expires_at)
    values (
      p_tenant, v_membership.id, v_program.id, v_program.reward_title,
      case when v_program.reward_expires_days is null then null
           else now() + make_interval(days => v_program.reward_expires_days) end
    )
    returning * into v_reward;
  end if;

  return jsonb_build_object(
    'ok', true,
    'stamps_count', v_membership.stamps_count,
    'stamps_required', v_program.stamps_required,
    'reward_earned', v_reward.id is not null
  );
end $$;

-- Mini app: "I want to use my free coffee" -> short code the barista types in.
create or replace function public.issue_redeem_code(
  p_reward      uuid,
  p_telegram_id bigint,
  p_ttl_minutes int default 5
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_reward  stampy_rewards;
  v_owner   bigint;
  v_attempt int := 0;
begin
  select r.* into v_reward from stampy_rewards r where r.id = p_reward for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select c.telegram_id into v_owner
  from stampy_memberships m join stampy_customers c on c.id = m.customer_id
  where m.id = v_reward.membership_id;

  if v_owner is distinct from p_telegram_id then
    return jsonb_build_object('ok', false, 'code', 'not_yours');
  end if;
  if v_reward.status <> 'earned' then
    return jsonb_build_object('ok', false, 'code', 'already_' || v_reward.status);
  end if;
  if v_reward.expires_at is not null and v_reward.expires_at <= now() then
    update stampy_rewards set status = 'expired' where id = p_reward;
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

  -- Reuse a code that is still live so re-opening the screen is not confusing.
  if v_reward.redeem_code is not null and v_reward.redeem_code_expires_at > now() then
    return jsonb_build_object('ok', true, 'code_value', v_reward.redeem_code,
                              'expires_at', v_reward.redeem_code_expires_at);
  end if;

  loop
    v_attempt := v_attempt + 1;
    begin
      update stampy_rewards
         set redeem_code = public.gen_code(4, '0123456789'),
             redeem_code_expires_at = now() + make_interval(mins => p_ttl_minutes)
       where id = p_reward
      returning * into v_reward;
      return jsonb_build_object('ok', true, 'code_value', v_reward.redeem_code,
                                'expires_at', v_reward.redeem_code_expires_at);
    exception when unique_violation then
      if v_attempt >= 8 then raise; end if;
    end;
  end loop;
end $$;

-- Cashier types the 4 digits. This is the only way a reward gets consumed.
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

-- Housekeeping, driven by cron.
create or replace function public.expire_stale()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_rewards int;
  v_tokens  int;
begin
  update stampy_rewards set status = 'expired'
   where status = 'earned' and expires_at is not null and expires_at <= now();
  get diagnostics v_rewards = row_count;

  delete from stampy_stamp_tokens where expires_at < now() - interval '2 days';
  get diagnostics v_tokens = row_count;

  return jsonb_build_object('expired_rewards', v_rewards, 'deleted_tokens', v_tokens);
end $$;

revoke all on function public.ensure_membership(uuid, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.claim_stamp(text, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.issue_redeem_code(uuid, bigint, int) from public, anon, authenticated;
revoke all on function public.expire_stale() from public, anon, authenticated;
grant execute on function public.add_manual_stamp(uuid, text, uuid) to authenticated;
grant execute on function public.redeem_reward(uuid, text, uuid) to authenticated;
