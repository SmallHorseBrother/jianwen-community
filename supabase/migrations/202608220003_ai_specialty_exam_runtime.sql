-- Public practice runtime for the six A-F paper banks.
-- These sessions are diagnostic practice only and never change the formal
-- capability level, group route, payment status, display ID or QR entitlement.
begin;

create table if not exists public.ai_specialty_exam_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paper_code text not null check (paper_code in ('A','B','C','D','E','F')),
  mode text not null check (mode in ('standard','full','practical')),
  item_ids text[] not null,
  presentation jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','completed','expired')),
  objective_score numeric not null default 0,
  objective_max_score numeric not null default 0,
  result jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(item_ids) > 0)
);

create table if not exists public.ai_specialty_exam_responses (
  session_id uuid not null references public.ai_specialty_exam_sessions(id) on delete cascade,
  item_id text not null references public.ai_assessment_items(id) on delete restrict,
  response_payload jsonb not null default '{}'::jsonb,
  raw_score numeric,
  max_score numeric,
  scorer_type text not null check (scorer_type in ('rule','self_review','llm','fallback')),
  feedback jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, item_id)
);

create index if not exists ai_specialty_exam_sessions_owner_idx
  on public.ai_specialty_exam_sessions (user_id, created_at desc);
create index if not exists ai_specialty_exam_sessions_paper_idx
  on public.ai_specialty_exam_sessions (paper_code, mode, status);

alter table public.ai_specialty_exam_sessions enable row level security;
alter table public.ai_specialty_exam_responses enable row level security;

drop policy if exists ai_specialty_exam_sessions_service_all on public.ai_specialty_exam_sessions;
create policy ai_specialty_exam_sessions_service_all
  on public.ai_specialty_exam_sessions for all to service_role
  using (true) with check (true);

drop policy if exists ai_specialty_exam_responses_service_all on public.ai_specialty_exam_responses;
create policy ai_specialty_exam_responses_service_all
  on public.ai_specialty_exam_responses for all to service_role
  using (true) with check (true);

comment on table public.ai_specialty_exam_sessions is
  'A-F practice paper sessions. Results are learning diagnostics and cannot alter formal level or community entitlements.';
comment on table public.ai_specialty_exam_responses is
  'Server-scored responses. Hidden scoring payloads remain in ai_assessment_items and are never copied to browser presentation.';

commit;
