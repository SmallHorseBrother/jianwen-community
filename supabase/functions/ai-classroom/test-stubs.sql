-- 本地测试用的 Supabase 替身：在空的 Postgres 里先执行这个文件，再依次执行
--   supabase/migrations/202610220001_ai_classroom_and_credits.sql
--   supabase/migrations/202610280001_ai_credit_guard_and_shop.sql
-- 然后运行 core.test.mjs。只在本地测试库用，不要在 Supabase 上执行。

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create schema if not exists storage;

-- 和 Supabase 一样：public 里新建的表、函数、序列默认单独授权给 anon / authenticated / service_role。
-- 少了这几行，本地测不出“只 revoke from public 收不回浏览器端执行权限”的问题。
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

create table if not exists auth.users (id uuid primary key, is_anonymous boolean not null default false);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean, file_size_limit bigint, allowed_mime_types text[]
);

create table if not exists public.profiles (id uuid primary key, user_role text);
create or replace function public.is_app_admin() returns boolean language sql stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and user_role in ('admin', 'super_admin'))
$$;
create or replace function public.update_updated_at_column() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end
$$;
