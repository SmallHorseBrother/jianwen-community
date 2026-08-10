-- Dual AI portrait assessments: capability history, personality history and cached reports.
-- Anonymous Supabase users are still authenticated principals, so ownership stays on auth.uid().

alter table public.ai_assessments
  drop constraint if exists ai_assessments_score_check;

alter table public.ai_assessments
  add constraint ai_assessments_score_check check (score between 0 and 90),
  add column if not exists ability_level smallint check (ability_level between 0 and 5),
  add column if not exists dimension_scores jsonb not null default '{}'::jsonb,
  add column if not exists track text check (track in ('daily', 'work'));

comment on column public.ai_assessments.level is
  'Paid community route. Capability Level 0-1 maps to starter, 2-3 to application, 4-5 to practice.';
comment on column public.ai_assessments.ability_level is 'Deterministic AI capability level from 0 to 5.';
comment on column public.ai_assessments.dimension_scores is 'Six normalized scores from 0 to 100.';

create table if not exists public.ai_assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('capability', 'personality')),
  assessment_version text not null,
  answers jsonb not null,
  track text check (track in ('daily', 'work')),
  learning_goal text check (learning_goal in ('office', 'content', 'learning', 'product', 'programming')),
  total_score smallint,
  ability_level smallint check (ability_level between 0 and 5),
  personality_code text check (personality_code is null or personality_code ~ '^[ED][CO][TA][HS]$'),
  dimension_scores jsonb not null default '{}'::jsonb,
  deterministic_report jsonb not null default '{}'::jsonb,
  ai_report jsonb,
  report_status text not null default 'pending' check (report_status in ('pending', 'ready', 'fallback', 'failed')),
  report_model text,
  share_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_assessment_attempt_shape check (
    (
      kind = 'capability'
      and track is not null
      and learning_goal is not null
      and total_score between 0 and 90
      and ability_level is not null
      and personality_code is null
    )
    or
    (
      kind = 'personality'
      and track is null
      and learning_goal is null
      and total_score is null
      and ability_level is null
      and personality_code is not null
    )
  )
);

create index if not exists ai_assessment_attempts_user_kind_created_idx
  on public.ai_assessment_attempts (user_id, kind, created_at desc);

drop trigger if exists update_ai_assessment_attempts_updated_at on public.ai_assessment_attempts;
create trigger update_ai_assessment_attempts_updated_at
  before update on public.ai_assessment_attempts
  for each row execute function public.update_updated_at_column();

alter table public.ai_assessment_attempts enable row level security;

drop policy if exists ai_assessment_attempts_select_own_or_admin on public.ai_assessment_attempts;
create policy ai_assessment_attempts_select_own_or_admin
  on public.ai_assessment_attempts for select to authenticated
  using ((select auth.uid()) = user_id or public.is_app_admin());

revoke all on public.ai_assessment_attempts from anon, authenticated;
grant select on public.ai_assessment_attempts to authenticated;

comment on table public.ai_assessment_attempts is
  'Immutable capability and personality attempts. Writes are owned by the assessment Edge Function.';
comment on column public.ai_assessment_attempts.share_token is
  'Unguessable public result token; shared responses must never expose answers or user_id.';
