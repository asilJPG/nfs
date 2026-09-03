-- Staff are invited by email before they have ever signed in, so their row has
-- no auth_user_id yet. On first login this claims the pending row.

create or replace function public.claim_staff_invite()
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_staff uuid;
begin
  if v_uid is null then
    return null;
  end if;

  select id into v_staff from stampy_staff_users where auth_user_id = v_uid;
  if found then
    return v_staff;
  end if;

  select email into v_email from auth.users where id = v_uid;
  if v_email is null then
    return null;
  end if;

  update stampy_staff_users
     set auth_user_id = v_uid
   where auth_user_id is null
     and lower(email) = lower(v_email)
     and active
  returning id into v_staff;

  return v_staff;
end $$;

grant execute on function public.claim_staff_invite() to authenticated;
