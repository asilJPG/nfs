-- Materialising a broadcast's audience. Done in SQL so the whole fan-out is one
-- statement and the shop never gets direct INSERT rights on stampy_broadcast_targets.

create or replace function public.queue_broadcast(p_broadcast uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_broadcast stampy_broadcasts;
  v_tenant    stampy_tenants;
  v_today     int;
  v_count     int;
begin
  select * into v_broadcast from stampy_broadcasts where id = p_broadcast for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if not public.can_manage_tenant(v_broadcast.tenant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_broadcast.status <> 'draft' then
    return jsonb_build_object('ok', false, 'code', 'already_queued');
  end if;

  select * into v_tenant from stampy_tenants where id = v_broadcast.tenant_id;
  if not public.tenant_is_serving(v_tenant) then
    return jsonb_build_object('ok', false, 'code', 'tenant_inactive');
  end if;

  -- Daily cap protects the shop's own audience from being burned out.
  select count(*) into v_today from stampy_broadcasts
  where tenant_id = v_broadcast.tenant_id
    and status in ('sending', 'done')
    and coalesce(started_at, created_at) >= date_trunc('day', now() at time zone 'Asia/Tashkent')
                                            at time zone 'Asia/Tashkent';
  if v_today >= v_tenant.daily_broadcast_cap then
    return jsonb_build_object('ok', false, 'code', 'daily_cap', 'cap', v_tenant.daily_broadcast_cap);
  end if;

  insert into stampy_broadcast_targets (broadcast_id, tenant_id, customer_id, telegram_id)
  select p_broadcast, v_broadcast.tenant_id, s.customer_id, s.telegram_id
  from public.segment_customers(v_broadcast.tenant_id, v_broadcast.segment) s
  on conflict (broadcast_id, customer_id) do nothing;
  get diagnostics v_count = row_count;

  if v_count = 0 then
    return jsonb_build_object('ok', false, 'code', 'empty_audience');
  end if;

  update stampy_broadcasts
     set status = case when scheduled_at is null or scheduled_at <= now() then 'sending' else 'scheduled' end,
         started_at = case when scheduled_at is null or scheduled_at <= now() then now() else null end
   where id = p_broadcast;

  return jsonb_build_object('ok', true, 'recipients', v_count);
end $$;

grant execute on function public.queue_broadcast(uuid) to authenticated;

-- How many people a segment would reach, without creating anything.
create or replace function public.segment_size(p_tenant uuid, p_segment jsonb)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.segment_customers(p_tenant, p_segment)
$$;

grant execute on function public.segment_size(uuid, jsonb) to authenticated;
