-- Logo storage. Public read (logos show inside the mini app for anyone with the
-- card), writes limited to the owning tenant's managers. Files live under
-- <tenant_id>/… so the folder name is the tenancy check.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152,
        array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "logos are readable by anyone"
  on storage.objects for select
  using (bucket_id = 'logos');

create policy "managers upload their own logo"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'logos'
    and public.can_manage_tenant(((storage.foldername(name))[1])::uuid)
  );

create policy "managers replace their own logo"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'logos'
    and public.can_manage_tenant(((storage.foldername(name))[1])::uuid)
  );

create policy "managers delete their own logo"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'logos'
    and public.can_manage_tenant(((storage.foldername(name))[1])::uuid)
  );
