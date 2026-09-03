/**
 * The slice of Supabase's platform our migrations depend on, rebuilt for a
 * bare Postgres (PGlite) so the SQL can be tested locally: the three roles,
 * the `auth` and `storage` schemas, and the default grants Supabase hands to
 * every new table in `public`.
 */
export const SUPABASE_STUBS = `
create role anon;
create role authenticated;
create role service_role;

create schema if not exists auth;
create schema if not exists extensions;
create schema if not exists storage;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

-- Supabase grants everything on new public objects and then relies on RLS.
-- Reproducing that is what makes the isolation tests meaningful.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create table auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique
);
grant select on auth.users to authenticated, service_role;

-- Supabase reads the caller out of the JWT; the stub uses the same GUC so a
-- test can impersonate a user with set_config('request.jwt.claim.sub', …).
create or replace function auth.uid() returns uuid language sql stable as $fn$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$fn$;

create table storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name      text not null,
  owner     uuid
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[] language sql immutable as $fn$
  select string_to_array(name, '/')
$fn$;
`;
