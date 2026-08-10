-- AI Usage Style v1 Beta.
--
-- This migration keeps all legacy ai-personality-v1 attempts intact. The new
-- four-letter codes and 0-100 axes are not conversions of the old model.

insert into public.ai_assessment_instruments (
  id, framework_version, item_bank_version, scoring_version,
  instrument_type, title, description, item_count, status, config
)
values (
  'ai-usage-style-v1-beta',
  'ai-usage-style-v1',
  'ai-style-item-bank-1.0.0',
  'ai-style-scoring-1.0.0',
  'personality',
  'AI 使用风格画像 Beta',
  '24 道七点量表计分题与 4 道不计分行为权衡题；输出四条连续偏好轴和 16 种传播画像。',
  28,
  'candidate',
  '{
    "scored_item_count": 24,
    "experimental_item_count": 4,
    "axes": ["ES", "CO", "RA", "PD"],
    "construct": "usage_style_not_capability",
    "public_label": "beta"
  }'::jsonb
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

-- Permit both historical codes (ED/CO/TA/HS) and the new usage-style codes
-- (ES/CO/RA/PD). The framework_version remains the source of truth.
alter table public.ai_assessment_attempts
  drop constraint if exists ai_assessment_attempts_personality_code_check;

alter table public.ai_assessment_attempts
  add constraint ai_assessment_attempts_personality_code_check check (
    personality_code is null
    or personality_code ~ '^[ED][CO][TA][HS]$'
    or personality_code ~ '^[ES][CO][RA][PD]$'
  );

create table if not exists public.ai_style_responses (
  attempt_id uuid not null references public.ai_assessment_attempts(id) on delete cascade,
  instrument_version text not null,
  item_id text not null check (item_id ~ '^(ES|CO|RA|PD|FX)[0-9]{2}$'),
  axis_code text not null check (axis_code in ('ES', 'CO', 'RA', 'PD')),
  response_payload jsonb not null,
  response_value smallint,
  forced_choice text check (forced_choice is null or forced_choice in ('first', 'second')),
  centered_score smallint check (centered_score is null or centered_score between -3 and 3),
  scored boolean not null,
  created_at timestamptz not null default now(),
  primary key (attempt_id, item_id),
  constraint ai_style_response_shape check (
    (
      scored
      and response_value between 1 and 7
      and forced_choice is null
      and centered_score is not null
    )
    or
    (
      not scored
      and response_value is null
      and forced_choice is not null
      and centered_score is null
    )
  )
);

create index if not exists ai_style_responses_item_analysis_idx
  on public.ai_style_responses (instrument_version, item_id, response_value)
  where scored;

alter table public.ai_style_responses enable row level security;

-- Raw style responses and scoring directions remain server-only. The Edge
-- Function returns sanitized questions and result snapshots.
revoke all on table public.ai_style_responses from anon, authenticated;
grant select, insert, update, delete on table public.ai_style_responses to service_role;

comment on table public.ai_style_responses is
  'Server-only item responses for AI Usage Style validation and rescoring.';
comment on column public.ai_style_responses.centered_score is
  'Deterministic reverse-coded contribution from -3 to +3; null for experimental items.';
