-- Harden public API access. The browser-side anon key is public by design, so
-- every table reachable from PostgREST must be protected by RLS and narrow grants.

alter table public.profiles
  add column if not exists user_role text not null default 'member';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_user_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_user_role_check
      check (user_role in ('member', 'admin', 'super_admin'));
  end if;
end $$;

create or replace function public.is_app_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_uid uuid := auth.uid();
  has_admin_role boolean := false;
begin
  if current_uid is null then
    return false;
  end if;

  select exists (
    select 1
    from public.profiles
    where id = current_uid
      and user_role in ('admin', 'super_admin')
  )
  into has_admin_role;

  if has_admin_role then
    return true;
  end if;

  if to_regclass('public.admin_users') is not null then
    execute 'select exists (select 1 from public.admin_users where user_id = $1)'
      into has_admin_role
      using current_uid;
  end if;

  return coalesce(has_admin_role, false);
end;
$$;

revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to anon, authenticated;

-- The old password-reset RPC allowed anonymous password changes by phone number.
-- Disable anonymous access until this is replaced with Supabase Auth OTP/email recovery.
do $$
begin
  if to_regprocedure('public.reset_user_password(text,text)') is not null then
    revoke execute on function public.reset_user_password(text, text) from anon;
  end if;
end $$;

-- profiles
alter table public.profiles enable row level security;

drop policy if exists "用户可以查看自己的资料" on public.profiles;
drop policy if exists "所有人可以查看公开的用户资料" on public.profiles;
drop policy if exists "用户可以更新自己的资料" on public.profiles;
drop policy if exists "用户可以插入自己的资料" on public.profiles;
drop policy if exists "profiles_select_policy" on public.profiles;
drop policy if exists profiles_select_public_or_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;

create policy profiles_select_public_or_own
  on public.profiles
  for select
  to anon, authenticated
  using (is_public = true or auth.uid() = id or public.is_app_admin());

create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy profiles_admin_update
  on public.profiles
  for update
  to authenticated
  using (public.is_app_admin())
  with check (true);

-- Anonymous users can read public profile fields, but not phone/contact columns.
revoke all on public.profiles from anon;
grant select (
  id,
  nickname,
  bio,
  avatar_url,
  bench_press,
  squat,
  deadlift,
  is_public,
  group_identity,
  profession,
  group_nickname,
  specialties,
  fitness_interests,
  learning_interests,
  tags,
  skills_offering,
  skills_seeking,
  age,
  gender,
  created_at,
  updated_at
) on public.profiles to anon;
grant select, insert, update on public.profiles to authenticated;

-- admin_users
create table if not exists public.admin_users (
  user_id uuid references auth.users(id) on delete cascade primary key,
  role text default 'admin' check (role in ('admin', 'super_admin')),
  created_at timestamptz default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "管理员可以查看管理员列表" on public.admin_users;
drop policy if exists admin_users_select_self_or_admin on public.admin_users;

create policy admin_users_select_self_or_admin
  on public.admin_users
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_app_admin());
