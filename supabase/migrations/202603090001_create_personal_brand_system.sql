-- 个人主页 + 数字人 MVP
-- 说明:
-- 1. 这份迁移会创建个人主页、内容条目、附件三张表
-- 2. 会创建 personal-files 存储桶，当前按公开附件 MVP 方案配置
-- 3. Kimi / DashScope 的 API Key 不在这里配置，请在 Edge Function Secret 中设置

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.personal_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  display_name text not null,
  headline text default '' not null,
  intro text default '' not null,
  long_bio text default '' not null,
  location text,
  email_public text,
  wechat_public text,
  social_links jsonb default '{}'::jsonb not null,
  expertise text[] default '{}'::text[] not null,
  ai_enabled boolean default true not null,
  ai_welcome_message text default '' not null,
  ai_system_prompt text default '' not null,
  is_public boolean default true not null,
  created_at timestamptz default timezone('utc', now()) not null,
  updated_at timestamptz default timezone('utc', now()) not null,
  constraint personal_profiles_owner_unique unique (owner_id)
);

create table if not exists public.personal_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.personal_profiles(id) on delete cascade,
  entry_type text not null check (entry_type in ('resume', 'paper', 'venture', 'project', 'custom')),
  title text not null,
  subtitle text,
  organization text,
  start_date text,
  end_date text,
  is_ongoing boolean default false not null,
  summary text,
  content text,
  highlights text[] default '{}'::text[] not null,
  links jsonb default '[]'::jsonb not null,
  sort_order integer default 0 not null,
  is_public boolean default true not null,
  created_at timestamptz default timezone('utc', now()) not null,
  updated_at timestamptz default timezone('utc', now()) not null
);

create table if not exists public.personal_files (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.personal_profiles(id) on delete cascade,
  entry_id uuid references public.personal_entries(id) on delete set null,
  title text not null,
  description text,
  file_path text not null,
  file_url text not null,
  mime_type text,
  size_bytes bigint,
  extracted_text text,
  is_public boolean default true not null,
  use_for_ai boolean default true not null,
  created_at timestamptz default timezone('utc', now()) not null,
  updated_at timestamptz default timezone('utc', now()) not null
);

create index if not exists personal_profiles_owner_id_idx on public.personal_profiles(owner_id);
create index if not exists personal_profiles_is_public_idx on public.personal_profiles(is_public);
create index if not exists personal_profiles_slug_idx on public.personal_profiles(slug);
create index if not exists personal_entries_profile_id_idx on public.personal_entries(profile_id);
create index if not exists personal_entries_type_sort_idx on public.personal_entries(profile_id, entry_type, sort_order);
create index if not exists personal_files_profile_id_idx on public.personal_files(profile_id);

drop trigger if exists set_personal_profiles_updated_at on public.personal_profiles;
create trigger set_personal_profiles_updated_at
before update on public.personal_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_personal_entries_updated_at on public.personal_entries;
create trigger set_personal_entries_updated_at
before update on public.personal_entries
for each row execute function public.set_updated_at();

drop trigger if exists set_personal_files_updated_at on public.personal_files;
create trigger set_personal_files_updated_at
before update on public.personal_files
for each row execute function public.set_updated_at();

alter table public.personal_profiles enable row level security;
alter table public.personal_entries enable row level security;
alter table public.personal_files enable row level security;

drop policy if exists "public can read personal profiles" on public.personal_profiles;
create policy "public can read personal profiles"
on public.personal_profiles
for select
to authenticated, anon
using (is_public = true);

drop policy if exists "owner can manage personal profiles" on public.personal_profiles;
create policy "owner can manage personal profiles"
on public.personal_profiles
for all
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "public can read public personal entries" on public.personal_entries;
create policy "public can read public personal entries"
on public.personal_entries
for select
to authenticated, anon
using (
  is_public = true
  and exists (
    select 1
    from public.personal_profiles p
    where p.id = personal_entries.profile_id
      and p.is_public = true
  )
);

drop policy if exists "owner can manage personal entries" on public.personal_entries;
create policy "owner can manage personal entries"
on public.personal_entries
for all
to authenticated
using (
  exists (
    select 1
    from public.personal_profiles p
    where p.id = personal_entries.profile_id
      and p.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.personal_profiles p
    where p.id = personal_entries.profile_id
      and p.owner_id = auth.uid()
  )
);

drop policy if exists "public can read public personal files" on public.personal_files;
create policy "public can read public personal files"
on public.personal_files
for select
to authenticated, anon
using (
  is_public = true
  and exists (
    select 1
    from public.personal_profiles p
    where p.id = personal_files.profile_id
      and p.is_public = true
  )
);

drop policy if exists "owner can manage personal files" on public.personal_files;
create policy "owner can manage personal files"
on public.personal_files
for all
to authenticated
using (
  exists (
    select 1
    from public.personal_profiles p
    where p.id = personal_files.profile_id
      and p.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.personal_profiles p
    where p.id = personal_files.profile_id
      and p.owner_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('personal-files', 'personal-files', true)
on conflict (id) do nothing;

drop policy if exists "public read personal files bucket" on storage.objects;
create policy "public read personal files bucket"
on storage.objects
for select
to authenticated, anon
using (bucket_id = 'personal-files');

drop policy if exists "authenticated upload personal files bucket" on storage.objects;
create policy "authenticated upload personal files bucket"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'personal-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated update personal files bucket" on storage.objects;
create policy "authenticated update personal files bucket"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'personal-files'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'personal-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated delete personal files bucket" on storage.objects;
create policy "authenticated delete personal files bucket"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'personal-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);
