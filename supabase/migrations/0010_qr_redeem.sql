-- Kill the 4-digit code path. QR encodes an opaque token; barista scans it.
create or replace function public.issue_redeem_code(
  p_reward      uuid,
  p_telegram_id bigint,
  p_ttl_minutes int default 5
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_reward stampy_rewards;
  v_owner  bigint;
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

  if v_reward.redeem_code is not null and v_reward.redeem_code_expires_at > now() then
    return jsonb_build_object('ok', true, 'code_value', v_reward.redeem_code,
                              'expires_at', v_reward.redeem_code_expires_at);
  end if;

  update stampy_rewards
     set redeem_code = replace(gen_random_uuid()::text, '-', ''),
         redeem_code_expires_at = now() + make_interval(mins => p_ttl_minutes)
   where id = p_reward
  returning * into v_reward;

  return jsonb_build_object('ok', true, 'code_value', v_reward.redeem_code,
                            'expires_at', v_reward.redeem_code_expires_at);
end $$;
