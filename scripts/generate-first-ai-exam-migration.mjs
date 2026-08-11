import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(root, 'supabase/migrations/20260811203644_first_ai_exam_2026_v1.sql');

async function loadTypeScriptModule(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

function sqlLiteral(value) {
  return `$$${String(value).replaceAll('$$', '$ $')}$$`;
}

function json(value) {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

const { FIRST_AI_EXAM_BANK, FIRST_AI_EXAM_INSTRUMENT } = await loadTypeScriptModule(
  'supabase/functions/_shared/firstAIExam.ts',
);

if (FIRST_AI_EXAM_BANK.length !== 54) {
  throw new Error(`Expected 54 first-exam candidate items, received ${FIRST_AI_EXAM_BANK.length}`);
}

const expectedKinds = { choice: 30, fill: 6, numeric: 6, code: 6, open: 6 };
for (const [kind, expected] of Object.entries(expectedKinds)) {
  const actual = FIRST_AI_EXAM_BANK.filter((item) => item.kind === kind).length;
  if (actual !== expected) throw new Error(`${kind}: expected ${expected}, received ${actual}`);
}
for (const dimension of ['M', 'F', 'T', 'V', 'C', 'S']) {
  const items = FIRST_AI_EXAM_BANK.filter((item) => item.dimension === dimension);
  if (items.length !== 9) throw new Error(`${dimension}: expected 9 items, received ${items.length}`);
}

const rows = FIRST_AI_EXAM_BANK.map((item) => {
  const promptPayload = {
    section: item.section,
    kind: item.kind,
    prompt: item.prompt,
    code: item.code,
    options: item.options?.map(({ id, text }) => ({ id, text })),
    placeholder: item.placeholder,
    unscored: Boolean(item.unscored),
  };
  const scoringPayload = {
    option_scores: item.options?.map(({ id, score }) => ({ id, score })),
    accepted_answers: item.acceptedAnswers,
    numeric_answer: item.numericAnswer,
    numeric_tolerance: item.numericTolerance,
    unscored: Boolean(item.unscored),
  };
  return `(${sqlLiteral(item.id)}, ${sqlLiteral(FIRST_AI_EXAM_INSTRUMENT.itemBankVersion)}, ${sqlLiteral(item.competencyId)}, ${sqlLiteral(item.dimension)}, ${item.targetLevel}, ${sqlLiteral(item.kind)}, ${json(promptPayload)}, ${json(scoringPayload)}, ${sqlLiteral(item.rationale)}, array['first-ai-exam-2026-pilot']::text[], true, 'active')`;
});

const config = {
  pool_size: 54,
  delivered_items: 32,
  scored_items: 30,
  unscored_open_items: 2,
  sampling: {
    dimensions: ['M', 'F', 'T', 'V', 'C', 'S'],
    per_dimension: { basic_choice: 2, scenario_choice: 1, fill_or_numeric: 1, technical: 1 },
  },
  sections: ['basic', 'scenario', 'fill', 'technical', 'open'],
  evidence_grade: 'screening',
};

const migration = `-- First AI Capability Exam 2026 pilot: mixed-format bank and active instrument.
-- Historical attempts, results, payment orders, memberships, display IDs and QR routes are preserved.

alter table public.ai_assessment_items
  drop constraint if exists ai_assessment_items_item_type_check;

alter table public.ai_assessment_items
  add constraint ai_assessment_items_item_type_check
  check (item_type in ('objective', 'scenario', 'constructed', 'practical', 'choice', 'fill', 'numeric', 'code', 'open'));

insert into public.ai_assessment_instruments (
  id, framework_version, item_bank_version, scoring_version,
  instrument_type, title, description, item_count, status, config, published_at
)
values (
  ${sqlLiteral(FIRST_AI_EXAM_INSTRUMENT.id)},
  ${sqlLiteral(FIRST_AI_EXAM_INSTRUMENT.frameworkVersion)},
  ${sqlLiteral(FIRST_AI_EXAM_INSTRUMENT.itemBankVersion)},
  ${sqlLiteral(FIRST_AI_EXAM_INSTRUMENT.scoringVersion)},
  'quick',
  ${sqlLiteral(FIRST_AI_EXAM_INSTRUMENT.title)},
  ${sqlLiteral('从 54 道服务端候选题中分层抽取 30 道计分题与 2 道不计分主观题，覆盖六项 AI 能力与五种题型。')},
  ${FIRST_AI_EXAM_INSTRUMENT.itemCount},
  'active',
  ${json(config)},
  now()
)
on conflict (id) do update
set framework_version = excluded.framework_version,
    item_bank_version = excluded.item_bank_version,
    scoring_version = excluded.scoring_version,
    title = excluded.title,
    description = excluded.description,
    item_count = excluded.item_count,
    status = excluded.status,
    config = excluded.config,
    published_at = coalesce(public.ai_assessment_instruments.published_at, excluded.published_at),
    retired_at = null,
    updated_at = now();

update public.ai_assessment_instruments
set status = 'retired', retired_at = coalesce(retired_at, now()), updated_at = now()
where instrument_type in ('quick', 'full', 'applied_lab')
  and id <> ${sqlLiteral(FIRST_AI_EXAM_INSTRUMENT.id)}
  and status <> 'retired';

insert into public.ai_assessment_items (
  id, item_bank_version, competency_id, dimension_code, target_level,
  item_type, prompt_payload, scoring_payload, rationale, source_anchors,
  quick_eligible, status
)
values
${rows.join(',\n')}
on conflict (id) do update
set item_bank_version = excluded.item_bank_version,
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

comment on constraint ai_assessment_items_item_type_check on public.ai_assessment_items is
  'Supports legacy PACF rows plus the mixed-format First AI Exam item bank.';
`;

fs.writeFileSync(outputPath, migration, 'utf8');
console.log(`Wrote ${outputPath} with ${FIRST_AI_EXAM_BANK.length} items.`);
