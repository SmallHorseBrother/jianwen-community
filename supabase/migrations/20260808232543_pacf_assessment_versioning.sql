-- PACF v1 assessment versioning and legacy-result preservation.
--
-- Important boundaries:
-- 1. Existing capability scores were produced by the legacy 30-item self-report
--    instrument. They are preserved, not converted into PACF v1 levels.
-- 2. Payment orders, active memberships, four-character display IDs and group
--    routes are deliberately untouched.
-- 3. Operational item keys and per-item responses are server-only data.

create table if not exists public.ai_assessment_instruments (
  id text primary key,
  framework_version text not null,
  item_bank_version text not null,
  scoring_version text not null,
  instrument_type text not null check (instrument_type in ('quick', 'full', 'applied_lab', 'personality')),
  title text not null,
  description text not null,
  item_count smallint not null check (item_count > 0),
  status text not null default 'candidate' check (status in ('candidate', 'pilot', 'active', 'retired')),
  config jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ai_assessment_instruments (
  id, framework_version, item_bank_version, scoring_version,
  instrument_type, title, description, item_count, status, config
)
values
  (
    'pacf-quick-v1-candidate',
    'pacf-1.0.0',
    'pacf-item-bank-1.0.0',
    'pacf-scoring-1.0.0',
    'quick',
    '个人 AI 能力快速筛查 v1',
    '30 个计分交互，六维各 5 个；用于筛查学习起点，不作为高阶认证。',
    30,
    'candidate',
    '{"form":"A","evidence_grade":"screening","dimensions":["M","F","T","V","C","S"]}'::jsonb
  ),
  (
    'pacf-full-v1-candidate',
    'pacf-1.0.0',
    'pacf-item-bank-1.0.0',
    'pacf-scoring-1.0.0',
    'full',
    '个人 AI 能力专业诊断 v1',
    '44 个计分交互，含 12 个开放作答与 2 个实作；上线前需要完成人工金标准和预测试。',
    44,
    'candidate',
    '{"form":"A","evidence_grade":"diagnostic","constructed_items":12,"practical_items":2}'::jsonb
  )
on conflict (id) do update
set
  framework_version = excluded.framework_version,
  item_bank_version = excluded.item_bank_version,
  scoring_version = excluded.scoring_version,
  title = excluded.title,
  description = excluded.description,
  item_count = excluded.item_count,
  config = excluded.config,
  updated_at = now();

create table if not exists public.ai_assessment_items (
  id text primary key,
  item_bank_version text not null,
  competency_id text not null check (competency_id ~ '^[MFTVCS][0-9]{2}$'),
  dimension_code text not null check (dimension_code in ('M', 'F', 'T', 'V', 'C', 'S')),
  target_level smallint not null check (target_level between 1 and 5),
  item_type text not null check (item_type in ('objective', 'scenario', 'constructed', 'practical')),
  prompt_payload jsonb not null,
  scoring_payload jsonb not null,
  rationale text not null,
  source_anchors text[] not null default '{}',
  quick_eligible boolean not null default false,
  status text not null default 'candidate' check (status in ('candidate', 'pilot', 'active', 'retired')),
  exposure_count bigint not null default 0 check (exposure_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_bank_version, id)
);

create index if not exists ai_assessment_items_bank_competency_idx
  on public.ai_assessment_items (item_bank_version, competency_id, item_type);

-- Preserve the current latest-result table while making its semantics explicit.
alter table public.ai_assessments
  drop constraint if exists ai_assessments_score_check;

alter table public.ai_assessments
  add constraint ai_assessments_score_check check (score between 0 and 100),
  add column if not exists assessment_version text not null default 'capability-v2-2026-08',
  add column if not exists framework_version text not null default 'legacy-ai-portrait-v2',
  add column if not exists scoring_version text not null default 'legacy-self-report-v2',
  add column if not exists result_status text not null default 'legacy'
    check (result_status in ('legacy', 'provisional', 'final', 'invalidated')),
  add column if not exists evidence_grade text not null default 'self_report'
    check (evidence_grade in ('self_report', 'screening', 'diagnostic', 'certified')),
  add column if not exists requires_reassessment boolean not null default true,
  add column if not exists competency_scores jsonb not null default '{}'::jsonb,
  add column if not exists gate_status jsonb not null default '{}'::jsonb;

comment on column public.ai_assessments.framework_version is
  'Meaning of the capability result. Legacy rows must never be relabelled as PACF v1.';
comment on column public.ai_assessments.requires_reassessment is
  'True when a current PACF result cannot be inferred safely from the stored legacy result.';

-- Expand attempts from the old 0-90 raw score to the PACF normalized 0-100 score.
alter table public.ai_assessment_attempts
  drop constraint if exists ai_assessment_attempt_shape;

alter table public.ai_assessment_attempts
  alter column total_score type numeric(5,2) using total_score::numeric,
  add column if not exists framework_version text not null default 'legacy-ai-portrait-v2',
  add column if not exists scoring_version text not null default 'legacy-self-report-v2',
  add column if not exists result_status text not null default 'legacy'
    check (result_status in ('legacy', 'provisional', 'final', 'invalidated')),
  add column if not exists evidence_grade text not null default 'self_report'
    check (evidence_grade in ('self_report', 'screening', 'diagnostic', 'certified', 'profile')),
  add column if not exists requires_reassessment boolean not null default true,
  add column if not exists competency_scores jsonb not null default '{}'::jsonb,
  add column if not exists gate_status jsonb not null default '{}'::jsonb,
  add column if not exists scoring_audit jsonb not null default '{}'::jsonb;

alter table public.ai_assessment_attempts
  add constraint ai_assessment_attempt_shape check (
    (
      kind = 'capability'
      and track is not null
      and learning_goal is not null
      and total_score between 0 and 100
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
  );

update public.ai_assessment_attempts
set
  framework_version = 'legacy-ai-portrait-v2',
  scoring_version = 'legacy-self-report-v2',
  result_status = 'legacy',
  evidence_grade = 'self_report',
  requires_reassessment = true,
  scoring_audit = jsonb_build_object(
    'migration', 'pacf_assessment_versioning',
    'note', 'Preserved without conversion because legacy level semantics differ from PACF v1.'
  )
where kind = 'capability'
  and framework_version <> 'pacf-1.0.0';

update public.ai_assessment_attempts
set
  framework_version = 'ai-personality-v1',
  scoring_version = 'personality-rules-v1',
  result_status = 'final',
  evidence_grade = 'profile',
  requires_reassessment = false
where kind = 'personality';

-- Store every latest legacy snapshot verbatim before PACF begins writing new results.
-- This also protects very early 8-item records that may not exist in attempts history.
create table if not exists public.ai_assessment_legacy_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_table text not null,
  source_record_key text not null,
  source_version text not null,
  raw_payload jsonb not null,
  migration_note text not null,
  captured_at timestamptz not null default now(),
  unique (source_table, source_record_key)
);

insert into public.ai_assessment_legacy_snapshots (
  user_id, source_table, source_record_key, source_version, raw_payload, migration_note
)
select
  assessment.user_id,
  'ai_assessments',
  assessment.user_id::text,
  coalesce(assessment.assessment_version, 'legacy-unversioned'),
  jsonb_build_object(
    'answers', assessment.answers,
    'score', assessment.score,
    'route_level', assessment.level,
    'learning_goal', assessment.learning_goal,
    'ability_level', assessment.ability_level,
    'dimension_scores', assessment.dimension_scores,
    'track', assessment.track,
    'created_at', assessment.created_at,
    'updated_at', assessment.updated_at
  ),
  'Archived verbatim. Do not convert this result into PACF v1; ask the user to retake the assessment.'
from public.ai_assessments as assessment
on conflict (source_table, source_record_key) do nothing;

create table if not exists public.ai_assessment_responses (
  attempt_id uuid not null references public.ai_assessment_attempts(id) on delete cascade,
  item_id text not null,
  competency_id text not null check (competency_id ~ '^[MFTVCS][0-9]{2}$'),
  response_payload jsonb not null,
  raw_score numeric(7,3),
  max_score numeric(7,3) check (max_score is null or max_score > 0),
  normalized_score numeric(5,2) check (normalized_score is null or normalized_score between 0 and 100),
  scorer_type text not null check (scorer_type in ('rule', 'llm_candidate', 'human', 'human_adjudicated')),
  rubric_version text,
  scoring_evidence jsonb not null default '{}'::jsonb,
  scored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (attempt_id, item_id)
);

create index if not exists ai_assessment_responses_item_analysis_idx
  on public.ai_assessment_responses (item_id, scored_at)
  where normalized_score is not null;

drop trigger if exists update_ai_assessment_instruments_updated_at on public.ai_assessment_instruments;
create trigger update_ai_assessment_instruments_updated_at
  before update on public.ai_assessment_instruments
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_ai_assessment_items_updated_at on public.ai_assessment_items;
create trigger update_ai_assessment_items_updated_at
  before update on public.ai_assessment_items
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_ai_assessment_responses_updated_at on public.ai_assessment_responses;
create trigger update_ai_assessment_responses_updated_at
  before update on public.ai_assessment_responses
  for each row execute function public.update_updated_at_column();

alter table public.ai_assessment_instruments enable row level security;
alter table public.ai_assessment_items enable row level security;
alter table public.ai_assessment_legacy_snapshots enable row level security;
alter table public.ai_assessment_responses enable row level security;

-- No user-facing policy is created for item keys, raw answers or legacy snapshots.
-- The assessment Edge Function uses a secret/service key and returns sanitized data.
revoke all on table
  public.ai_assessment_instruments,
  public.ai_assessment_items,
  public.ai_assessment_legacy_snapshots,
  public.ai_assessment_responses
from anon, authenticated;

grant select, insert, update, delete on table
  public.ai_assessment_instruments,
  public.ai_assessment_items,
  public.ai_assessment_legacy_snapshots,
  public.ai_assessment_responses
to service_role;

comment on table public.ai_assessment_items is
  'Server-only operational item bank. Never return scoring_payload to the browser.';
comment on table public.ai_assessment_responses is
  'Per-item response and scoring evidence for calibration, audit and rescoring.';
comment on table public.ai_assessment_legacy_snapshots is
  'Verbatim archive of pre-PACF latest results; intentionally excluded from current capability scoring.';
