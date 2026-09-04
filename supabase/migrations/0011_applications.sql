-- Заявки на подключение вместо саморегистрации. Формы принимает сервер (service_role),
-- читают и меняют статус только платформенные админы.
create table stampy_applications (
  id            uuid primary key default gen_random_uuid(),
  cafe_name     text not null,
  city          text,
  contact_name  text not null,
  phone         text not null,
  telegram      text,
  message       text,
  status        text not null default 'new'
                check (status in ('new', 'contacted', 'converted', 'rejected')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index applications_status_idx on stampy_applications (status, created_at desc);

alter table stampy_applications enable row level security;

create policy applications_read on stampy_applications for select to authenticated
  using (public.is_platform_admin());

create policy applications_update on stampy_applications for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create or replace function public.admin_set_application_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status not in ('new', 'contacted', 'converted', 'rejected') then
    raise exception 'bad_status';
  end if;
  update stampy_applications set status = p_status, updated_at = now() where id = p_id;
end $$;
