create table public.suggestions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  user_nickname text,
  title text not null,
  description text not null,
  category text default 'other'::text,
  status text default 'pending'::text check (status in ('pending', 'reviewing', 'approved', 'in_progress', 'completed', 'rejected')),
  admin_notes text default ''::text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.suggestions enable row level security;

-- Policies
create policy "Public suggestions are viewable by everyone"
  on public.suggestions for select
  using (true);

create policy "Users can insert their own suggestions"
  on public.suggestions for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own suggestions"
  on public.suggestions for update
  using ((select auth.uid()) = user_id);

create policy "Admins can update suggestions"
  on public.suggestions for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
      and profiles.user_role in ('admin', 'super_admin')
    )
  );

create policy "Admins can delete suggestions"
  on public.suggestions for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
      and profiles.user_role in ('admin', 'super_admin')
    )
  );
