-- Атомарный захват батча рассылки — чтобы два параллельных drain-а не слали одному гостю дважды.
alter table stampy_broadcast_targets add column if not exists claimed_at timestamptz;

create index if not exists broadcast_targets_claim_idx
  on stampy_broadcast_targets (broadcast_id, status, claimed_at) where status = 'pending';

create or replace function public.claim_broadcast_batch(p_broadcast uuid, p_batch int)
returns table(id uuid, telegram_id bigint, customer_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  return query
  update stampy_broadcast_targets t
     set claimed_at = now(),
         attempts = t.attempts + 1
   where t.id in (
     select t2.id from stampy_broadcast_targets t2
     where t2.broadcast_id = p_broadcast
       and t2.status = 'pending'
       and (t2.claimed_at is null or t2.claimed_at < now() - interval '5 minutes')
     order by t2.id
     for update skip locked
     limit greatest(1, least(1000, p_batch))
   )
  returning t.id, t.telegram_id, t.customer_id;
end $$;
