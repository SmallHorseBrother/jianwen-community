import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function readEnv(filePath) {
  return Object.fromEntries(fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
    .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')];
    }));
}

const root = path.resolve(import.meta.dirname, '..');
const env = readEnv(path.join(root, '.env'));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const service = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function invoke(body) {
  const { data, error } = await supabase.functions.invoke('ai-assessment-engine', { body });
  if (error) {
    let detail = error.message;
    try { detail = (await error.context.json()).error || detail; } catch { /* response may already be consumed */ }
    throw new Error(detail);
  }
  return data;
}

let userId;
try {
  const { data: auth, error: authError } = await supabase.auth.signInAnonymously();
  if (authError || !auth.user) throw authError || new Error('Anonymous sign-in returned no user');
  userId = auth.user.id;

  const first = await invoke({ action: 'pacf-quick-form' });
  const second = await invoke({ action: 'pacf-quick-form' });
  if (first.instrument.id !== 'first-ai-capability-exam-2026-v1') throw new Error('Wrong instrument');
  if (first.items.length !== 32 || first.instrument.scored_item_count !== 30) throw new Error('Wrong form length');

  const sectionCounts = Object.groupBy(first.items, (item) => item.section);
  const expectedSections = { basic: 12, scenario: 6, fill: 6, technical: 6, open: 2 };
  for (const [section, expected] of Object.entries(expectedSections)) {
    if ((sectionCounts[section] || []).length !== expected) throw new Error(`${section}: wrong count`);
  }
  for (const item of first.items) {
    if (item.options?.some((option) => 'score' in option)) throw new Error(`Scoring key leaked: ${item.id}`);
    if ('acceptedAnswers' in item || 'numericAnswer' in item || 'rationale' in item) throw new Error(`Answer leaked: ${item.id}`);
  }

  const firstIds = first.items.map((item) => item.id).join(',');
  const secondIds = second.items.map((item) => item.id).join(',');
  if (firstIds === secondIds) throw new Error('Two independently generated forms are identical');

  const responses = first.items.map((item) => ({
    item_id: item.id,
    value: item.options?.[0]?.id
      ?? (item.kind === 'numeric' ? 0 : item.kind === 'open' ? '我会先拆解目标、明确验收标准，再核验关键事实并记录过程。' : '不知道'),
  }));
  const submitted = await invoke({
    action: 'submit-pacf-quick',
    session_id: first.session_id,
    responses,
    track: 'work',
    learning_goal: 'product',
  });
  if (!submitted.attempt?.id) throw new Error('Submission did not create an attempt');

  const { data: storedAttempt, error: attemptError } = await service.from('ai_assessment_attempts')
    .select('assessment_version,scoring_audit').eq('id', submitted.attempt.id).single();
  if (attemptError) throw new Error(attemptError.message);
  if (storedAttempt.assessment_version !== first.instrument.id
    || storedAttempt.scoring_audit?.instrument_id !== first.instrument.id) {
    throw new Error('Stored attempt has the wrong instrument');
  }

  const { count: responseCount, error: countError } = await service.from('ai_assessment_responses')
    .select('*', { count: 'exact', head: true }).eq('attempt_id', submitted.attempt.id);
  if (countError || responseCount !== 32) throw countError || new Error(`Expected 32 response rows, received ${responseCount}`);

  let duplicateRejected = false;
  try {
    await invoke({ action: 'submit-pacf-quick', session_id: first.session_id, responses, track: 'work', learning_goal: 'product' });
  } catch {
    duplicateRejected = true;
  }
  if (!duplicateRejected) throw new Error('Duplicate session submission was accepted');

  console.log(JSON.stringify({
    ok: true,
    instrument: first.instrument.id,
    total_items: first.items.length,
    scored_items: first.instrument.scored_item_count,
    section_counts: Object.fromEntries(Object.entries(sectionCounts).map(([key, value]) => [key, value.length])),
    random_forms_differ: true,
    response_rows: responseCount,
    duplicate_rejected: true,
  }, null, 2));
} finally {
  if (userId) {
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) console.error(`Test user cleanup failed: ${error.message}`);
  }
}
