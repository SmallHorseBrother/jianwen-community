alter table public.feedback_tasks
  add column if not exists project_name text,
  add column if not exists project_path text,
  add column if not exists execution_mode text not null default 'manual',
  add column if not exists coding_agent text,
  add column if not exists execution_status text not null default 'not_ready';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'feedback_tasks_execution_mode_check'
      and conrelid = 'public.feedback_tasks'::regclass
  ) then
    alter table public.feedback_tasks
      add constraint feedback_tasks_execution_mode_check
      check (execution_mode in ('manual', 'ai_assist', 'auto_code'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'feedback_tasks_coding_agent_check'
      and conrelid = 'public.feedback_tasks'::regclass
  ) then
    alter table public.feedback_tasks
      add constraint feedback_tasks_coding_agent_check
      check (coding_agent in ('codex', 'claude') or coding_agent is null);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'feedback_tasks_execution_status_check'
      and conrelid = 'public.feedback_tasks'::regclass
  ) then
    alter table public.feedback_tasks
      add constraint feedback_tasks_execution_status_check
      check (execution_status in ('not_ready', 'ready', 'queued', 'running', 'review_required', 'done', 'failed'));
  end if;
end
$$;

create index if not exists feedback_tasks_project_name_idx
on public.feedback_tasks(project_name);

create index if not exists feedback_tasks_execution_fields_idx
on public.feedback_tasks(execution_mode, coding_agent, execution_status);
