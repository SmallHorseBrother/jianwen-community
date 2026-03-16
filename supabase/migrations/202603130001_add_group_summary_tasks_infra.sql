create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.feedback_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  type text not null default 'group_summary'::text,
  status text not null default 'pending'::text,
  priority text not null default 'medium'::text,
  source_group text not null,
  source_session_id text,
  source_from text,
  source_to text,
  evidence_json jsonb not null default '[]'::jsonb,
  tags_json jsonb not null default '[]'::jsonb,
  owner text,
  progress_note text default ''::text,
  is_public boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'feedback_tasks_type_check'
      and conrelid = 'public.feedback_tasks'::regclass
  ) then
    alter table public.feedback_tasks
      add constraint feedback_tasks_type_check
      check (type in ('group_summary', 'follow_up', 'todo', 'other'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'feedback_tasks_status_check'
      and conrelid = 'public.feedback_tasks'::regclass
  ) then
    alter table public.feedback_tasks
      add constraint feedback_tasks_status_check
      check (status in ('pending', 'in_progress', 'completed', 'cancelled'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'feedback_tasks_priority_check'
      and conrelid = 'public.feedback_tasks'::regclass
  ) then
    alter table public.feedback_tasks
      add constraint feedback_tasks_priority_check
      check (priority in ('low', 'medium', 'high', 'urgent'));
  end if;
end
$$;

create unique index if not exists feedback_tasks_source_group_title_uidx
on public.feedback_tasks(source_group, title);

create index if not exists feedback_tasks_public_updated_at_idx
on public.feedback_tasks(is_public, updated_at desc);

create index if not exists feedback_tasks_type_status_priority_idx
on public.feedback_tasks(type, status, priority);

create index if not exists feedback_tasks_source_group_idx
on public.feedback_tasks(source_group);
create index if not exists feedback_tasks_source_session_id_idx
on public.feedback_tasks(source_session_id);
create index if not exists feedback_tasks_created_by_idx
on public.feedback_tasks(created_by);

drop trigger if exists set_feedback_tasks_updated_at on public.feedback_tasks;
create trigger set_feedback_tasks_updated_at
before update on public.feedback_tasks
for each row execute function public.set_updated_at();

alter table public.feedback_tasks enable row level security;

drop policy if exists "public can read public feedback tasks" on public.feedback_tasks;
create policy "public can read public feedback tasks"
on public.feedback_tasks
for select
to authenticated, anon
using (is_public = true);

drop policy if exists "users can read own feedback tasks" on public.feedback_tasks;
create policy "users can read own feedback tasks"
on public.feedback_tasks
for select
to authenticated
using (auth.uid() = created_by);

drop policy if exists "users can insert own feedback tasks" on public.feedback_tasks;
create policy "users can insert own feedback tasks"
on public.feedback_tasks
for insert
to authenticated
with check (auth.uid() = created_by);

drop policy if exists "users can update own feedback tasks" on public.feedback_tasks;
create policy "users can update own feedback tasks"
on public.feedback_tasks
for update
to authenticated
using (auth.uid() = created_by)
with check (auth.uid() = created_by);

drop policy if exists "users can delete own feedback tasks" on public.feedback_tasks;
create policy "users can delete own feedback tasks"
on public.feedback_tasks
for delete
to authenticated
using (auth.uid() = created_by);