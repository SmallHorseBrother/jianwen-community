import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(
  root,
  'supabase/migrations/20260810102109_assessment_item_bank_sampling_v1_1.sql',
);

async function loadTypeScriptModule(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

function sqlLiteral(value) {
  return `$$${String(value).replaceAll('$$', '$ $')}$$`;
}

function json(value) {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

function textArray(values) {
  return `array[${values.map((value) => sqlLiteral(value)).join(', ')}]::text[]`;
}

const { pacfCandidateItemBank } = await loadTypeScriptModule('src/features/aiAssessment/pacfItemBank.ts');
const { usageStyleCandidateItems, usageStyleExperimentalItems } = await loadTypeScriptModule('src/features/aiAssessment/aiStyleItemBank.ts');

if (pacfCandidateItemBank.length !== 120) {
  throw new Error(`Expected 120 PACF candidate items, received ${pacfCandidateItemBank.length}`);
}
const pacfByDimension = Object.groupBy(pacfCandidateItemBank, (item) => item.dimension);
for (const dimension of ['M', 'F', 'T', 'V', 'C', 'S']) {
  const items = pacfByDimension[dimension] || [];
  const quickItems = items.filter((item) => item.quickEligible);
  const competencies = new Set(quickItems.map((item) => item.competencyId));
  if (items.length !== 20 || quickItems.length !== 10 || competencies.size !== 5) {
    throw new Error(`PACF ${dimension} must contain 20 total items, 10 quick items and 5 quick competencies`);
  }
}
if (usageStyleCandidateItems.length !== 56 || usageStyleExperimentalItems.length !== 4) {
  throw new Error('Expected 56 scored style candidates and 4 experimental items');
}
for (const axis of ['explore', 'create', 'reason', 'partner']) {
  for (const pole of ['first', 'second']) {
    const count = usageStyleCandidateItems.filter((item) => item.axis === axis && item.pole === pole).length;
    if (count !== 7) throw new Error(`Style ${axis}/${pole} requires seven parallel items, received ${count}`);
  }
}

const pacfRows = pacfCandidateItemBank.map((item) => {
  const prompt = item.type === 'objective' || item.type === 'scenario'
    ? { stem: item.stem, options: item.options.map(({ id, text }) => ({ id, text })) }
    : { stem: item.stem, rubric: item.rubric };
  const scoring = item.type === 'objective' || item.type === 'scenario'
    ? { option_scores: item.options.map(({ id, score }) => ({ id, score })) }
    : { rubric: item.rubric };
  return `(${sqlLiteral(item.id)}, 'pacf-item-bank-1.1.0', ${sqlLiteral(item.competencyId)}, ${sqlLiteral(item.dimension)}, ${item.targetLevel}, ${sqlLiteral(item.type)}, ${json(prompt)}, ${json(scoring)}, ${sqlLiteral(item.rationale)}, ${textArray(item.sourceAnchors)}, ${item.quickEligible}, 'active')`;
});

const axisCodes = { explore: 'ES', create: 'CO', reason: 'RA', partner: 'PD' };
const styleRows = [
  ...usageStyleCandidateItems.map((item) =>
    `(${sqlLiteral(item.id)}, 'ai-style-item-bank-1.1.0', '${axisCodes[item.axis]}', 'likert', ${json({ statement: item.statement, scale: { min: 1, max: 7 } })}, ${json({ pole: item.pole, scored: true })}, 'active')`
  ),
  ...usageStyleExperimentalItems.map((item) =>
    `(${sqlLiteral(item.id)}, 'ai-style-item-bank-1.1.0', '${axisCodes[item.axis]}', 'forced_choice', ${json({ prompt: item.prompt, options: [{ id: 'first', text: item.first }, { id: 'second', text: item.second }] })}, ${json({ scored: false })}, 'active')`
  ),
];

const migration = `-- Complete server-only item banks and reproducible balanced random delivery.
--
-- This migration replaces the unexecuted fixed v1.1 form registration. It does
-- not mutate historical attempts, results, payments, group memberships or IDs.
-- Every delivered form is recorded as a private session snapshot before answers
-- are accepted, so a result can be audited even after the active bank changes.

create table if not exists public.ai_assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_kind text not null check (assessment_kind in ('capability', 'personality')),
  instrument_id text not null references public.ai_assessment_instruments(id),
  item_bank_version text not null,
  presentation jsonb not null,
  status text not null default 'open' check (status in ('open', 'completed', 'expired')),
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_assessment_sessions_user_kind_created_idx
  on public.ai_assessment_sessions (user_id, assessment_kind, created_at desc);

alter table public.ai_assessment_attempts
  add column if not exists assessment_session_id uuid
    references public.ai_assessment_sessions(id) on delete restrict;

create unique index if not exists ai_assessment_attempts_one_per_session_idx
  on public.ai_assessment_attempts (assessment_session_id)
  where assessment_session_id is not null;

create table if not exists public.ai_style_items (
  id text primary key check (id ~ '^(ES|CO|RA|PD|FX)[0-9]{2}$'),
  item_bank_version text not null,
  axis_code text not null check (axis_code in ('ES', 'CO', 'RA', 'PD')),
  item_type text not null check (item_type in ('likert', 'forced_choice')),
  prompt_payload jsonb not null,
  scoring_payload jsonb not null,
  status text not null default 'candidate' check (status in ('candidate', 'pilot', 'active', 'retired')),
  exposure_count bigint not null default 0 check (exposure_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_style_items_bank_axis_idx
  on public.ai_style_items (item_bank_version, axis_code, item_type)
  where status = 'active';

insert into public.ai_assessment_instruments (
  id, framework_version, item_bank_version, scoring_version,
  instrument_type, title, description, item_count, status, config
)
values
  (
    'pacf-quick-v1.1-random',
    'pacf-1.0.0',
    'pacf-item-bank-1.1.0',
    'pacf-scoring-1.1.0',
    'quick',
    '个人 AI 能力随机筛查 v1.1',
    '从 120 道服务端题库按六维均衡抽取 42 道题；每个维度覆盖全部核心能力点，用于稳定定位学习起点。',
    42,
    'candidate',
    '{"sampling":{"dimensions":["M","F","T","V","C","S"],"items_per_dimension":7,"coverage":"all five competencies per dimension","eligible_item_types":["objective","scenario"]},"pool_size":120,"evidence_grade":"screening"}'::jsonb
  ),
  (
    'ai-usage-style-v1.1-random-beta',
    'ai-usage-style-v1',
    'ai-style-item-bank-1.1.0',
    'ai-style-scoring-1.1.0',
    'personality',
    'AI 使用风格随机画像 Beta',
    '从 56 道计分陈述中按四条偏好轴均衡抽取 32 道，并附 4 道不计分行为权衡题；风格不代表能力高低。',
    36,
    'candidate',
    '{"sampling":{"axes":["ES","CO","RA","PD"],"scored_items_per_axis":8,"per_pole":4,"experimental_item_count":4},"scored_pool_size":56,"construct":"usage_style_not_capability","public_label":"beta"}'::jsonb
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

insert into public.ai_assessment_items (
  id, item_bank_version, competency_id, dimension_code, target_level,
  item_type, prompt_payload, scoring_payload, rationale, source_anchors,
  quick_eligible, status
)
values
${pacfRows.join(',\n')}
on conflict (id) do update
set
  item_bank_version = excluded.item_bank_version,
  competency_id = excluded.competency_id,
  dimension_code = excluded.dimension_code,
  target_level = excluded.target_level,
  item_type = excluded.item_type,
  prompt_payload = excluded.prompt_payload,
  scoring_payload = excluded.scoring_payload,
  rationale = excluded.rationale,
  source_anchors = excluded.source_anchors,
  quick_eligible = excluded.quick_eligible,
  status = excluded.status,
  updated_at = now();

insert into public.ai_style_items (
  id, item_bank_version, axis_code, item_type, prompt_payload, scoring_payload, status
)
values
${styleRows.join(',\n')}
on conflict (id) do update
set
  item_bank_version = excluded.item_bank_version,
  axis_code = excluded.axis_code,
  item_type = excluded.item_type,
  prompt_payload = excluded.prompt_payload,
  scoring_payload = excluded.scoring_payload,
  status = excluded.status,
  updated_at = now();

drop trigger if exists update_ai_assessment_sessions_updated_at on public.ai_assessment_sessions;
create trigger update_ai_assessment_sessions_updated_at
  before update on public.ai_assessment_sessions
  for each row execute function public.update_updated_at_column();

drop trigger if exists update_ai_style_items_updated_at on public.ai_style_items;
create trigger update_ai_style_items_updated_at
  before update on public.ai_style_items
  for each row execute function public.update_updated_at_column();

alter table public.ai_assessment_sessions enable row level security;
alter table public.ai_style_items enable row level security;

revoke all on table public.ai_assessment_sessions, public.ai_style_items
  from anon, authenticated;
grant select, insert, update, delete on table public.ai_assessment_sessions, public.ai_style_items
  to service_role;

comment on table public.ai_assessment_sessions is
  'Server-only immutable delivery snapshot for balanced random assessment forms. Browser receives only sanitized prompts.';
comment on table public.ai_style_items is
  'Server-only AI usage-style bank. scoring_payload contains direction and must never be returned to the browser.';
`;

fs.writeFileSync(outputPath, migration, 'utf8');
console.log(`Wrote ${outputPath} with ${pacfCandidateItemBank.length} PACF and ${styleRows.length} style items; PACF quick pool is 60 (10 per dimension), style scored pool is 56 (7 per axis/pole).`);
