-- Дневной лимит по числу получателей, а не рассылок: одна рассылка на 100k гостей —
-- всё равно дорого и раздражает аудиторию.

alter table stampy_tenants
  add column if not exists daily_recipient_cap int not null default 5000
  check (daily_recipient_cap between 0 and 1000000);

create or replace function public.queue_broadcast(p_broadcast uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_broadcast   stampy_broadcasts;
  v_tenant      stampy_tenants;
  v_today_msgs  int;
  v_today_recs  int;
  v_count       int;
begin
  select * into v_broadcast from stampy_broadcasts where id = p_broadcast for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
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

  select count(*) into v_today_msgs from stampy_broadcasts
  where tenant_id = v_broadcast.tenant_id
    and status in ('sending', 'done')
    and coalesce(started_at, created_at) >= date_trunc('day', now() at time zone 'Asia/Tashkent')
                                            at time zone 'Asia/Tashkent';
  if v_today_msgs >= v_tenant.daily_broadcast_cap then
    return jsonb_build_object('ok', false, 'code', 'daily_cap', 'cap', v_tenant.daily_broadcast_cap);
  end if;

  select coalesce(sum(sent_count + failed_count), 0)::int into v_today_recs from stampy_broadcasts
  where tenant_id = v_broadcast.tenant_id
    and status in ('sending', 'done')
    and coalesce(started_at, created_at) >= date_trunc('day', now() at time zone 'Asia/Tashkent')
                                            at time zone 'Asia/Tashkent';

  v_count := public.segment_size(v_broadcast.tenant_id, v_broadcast.segment);
  if v_count = 0 then
    return jsonb_build_object('ok', false, 'code', 'empty_audience');
  end if;

  if v_today_recs + v_count > v_tenant.daily_recipient_cap then
    return jsonb_build_object(
      'ok', false, 'code', 'recipient_cap',
      'cap', v_tenant.daily_recipient_cap,
      'already_sent', v_today_recs,
      'would_send', v_count
    );
  end if;

  insert into stampy_broadcast_targets (broadcast_id, tenant_id, customer_id, telegram_id)
  select p_broadcast, v_broadcast.tenant_id, s.customer_id, s.telegram_id
  from public.segment_customers(v_broadcast.tenant_id, v_broadcast.segment) s
  on conflict (broadcast_id, customer_id) do nothing;
  get diagnostics v_count = row_count;

  update stampy_broadcasts
     set status = case when scheduled_at is null or scheduled_at <= now() then 'sending' else 'scheduled' end,
         started_at = case when scheduled_at is null or scheduled_at <= now() then now() else null end
   where id = p_broadcast;

  return jsonb_build_object('ok', true, 'recipients', v_count);
end $$;
