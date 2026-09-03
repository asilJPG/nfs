-- Вход по логину и паролю вместо магической ссылки на почту.
--
-- Supabase Auth умеет только email-идентификаторы, поэтому каждому сотруднику
-- заводится служебный адрес <username>@stampy.local. Письма на него никогда не
-- отправляются: аккаунты создаются админским API с email_confirm = true.
-- Почта остаётся как необязательный контакт, а не как способ входа.

alter table stampy_staff_users add column username text;

update stampy_staff_users
   set username = lower(split_part(email, '@', 1))
 where username is null;

alter table stampy_staff_users alter column username set not null;
alter table stampy_staff_users alter column email drop not null;

alter table stampy_staff_users
  add constraint stampy_staff_users_username_key unique (username),
  add constraint stampy_staff_users_username_format
    check (username ~ '^[a-z0-9][a-z0-9._-]{2,30}[a-z0-9]$');

-- Почта больше не идентификатор, значит и уникальной быть не обязана.
alter table stampy_staff_users drop constraint if exists stampy_staff_users_tenant_id_email_key;

-- Приглашения по почте больше не нужны: аккаунт и строка сотрудника создаются
-- одной операцией на сервере, auth_user_id проставляется сразу.
drop function if exists public.claim_staff_invite();

create or replace function public.create_tenant(
  p_name       text,
  p_slug       text,
  p_username   text,
  p_venue_name text default null,
  p_brand      jsonb default null,
  p_stamps     int default 6,
  p_reward     text default 'Бесплатный кофе'
)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid    uuid := auth.uid();
  v_tenant stampy_tenants;
  v_venue  stampy_venues;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from stampy_staff_users where auth_user_id = v_uid) then
    return jsonb_build_object('ok', false, 'code', 'already_has_tenant');
  end if;
  if exists (select 1 from stampy_tenants where slug = lower(trim(p_slug))) then
    return jsonb_build_object('ok', false, 'code', 'slug_taken');
  end if;
  if exists (select 1 from stampy_staff_users where username = lower(trim(p_username))) then
    return jsonb_build_object('ok', false, 'code', 'username_taken');
  end if;

  insert into stampy_tenants (slug, name, brand)
  values (lower(trim(p_slug)), trim(p_name), coalesce(p_brand, public.default_brand()))
  returning * into v_tenant;

  insert into stampy_venues (tenant_id, name)
  values (v_tenant.id, coalesce(nullif(trim(p_venue_name), ''), trim(p_name)))
  returning * into v_venue;

  insert into stampy_loyalty_programs (tenant_id, stamps_required, reward_title)
  values (v_tenant.id, greatest(2, least(20, p_stamps)), trim(p_reward));

  insert into stampy_staff_users (tenant_id, auth_user_id, username, role)
  values (v_tenant.id, v_uid, lower(trim(p_username)), 'owner');

  return jsonb_build_object('ok', true, 'tenant_id', v_tenant.id, 'slug', v_tenant.slug,
                            'venue_id', v_venue.id, 'trial_ends_at', v_tenant.trial_ends_at);
end $$;

drop function if exists public.create_tenant(text, text, text, jsonb, int, text);

grant execute on function public.create_tenant(text, text, text, text, jsonb, int, text) to authenticated;

-- Свободен ли логин. Нужен на экране регистрации до того, как что-то создано,
-- поэтому security definer: анонимный посетитель не видит таблицу сотрудников.
create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from stampy_staff_users where username = lower(trim(p_username))
  )
$$;

grant execute on function public.username_available(text) to anon, authenticated;
