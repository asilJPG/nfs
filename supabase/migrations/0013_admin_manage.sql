-- Управление кофейнями и метками из /admin.

create or replace function public.admin_update_tenant(
  p_tenant uuid,
  p_name   text,
  p_slug   text
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_slug is not null and p_slug <> '' then
    if exists (select 1 from stampy_tenants where slug = lower(trim(p_slug)) and id <> p_tenant) then
      return jsonb_build_object('ok', false, 'code', 'slug_taken');
    end if;
  end if;
  update stampy_tenants
     set name = coalesce(nullif(trim(p_name), ''), name),
         slug = coalesce(nullif(lower(trim(p_slug)), ''), slug),
         updated_at = now()
   where id = p_tenant;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_delete_tenant(p_tenant uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from stampy_tenants where id = p_tenant;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_delete_tag(p_uid text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from stampy_nfc_tags where uid = upper(trim(p_uid));
  return jsonb_build_object('ok', true);
end $$;

-- Возвращает auth_user_id владельца — нужно для смены пароля.
create or replace function public.admin_tenant_owner(p_tenant uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select auth_user_id into v_id
  from stampy_staff_users
  where tenant_id = p_tenant and role = 'owner'
  order by created_at
  limit 1;
  return v_id;
end $$;
