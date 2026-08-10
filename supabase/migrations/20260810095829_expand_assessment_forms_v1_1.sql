-- Expanded Beta forms preserve v1.0 results and introduce additional,
-- balanced items. Do not relabel earlier scores as v1.1 results.

insert into public.ai_assessment_instruments (
  id, framework_version, item_bank_version, scoring_version,
  instrument_type, title, description, item_count, status, config
)
values
  (
    'pacf-quick-v1.1-candidate',
    'pacf-1.0.0',
    'pacf-item-bank-1.0.0',
    'pacf-scoring-1.1.0',
    'quick',
    '个人 AI 能力扩展筛查 v1.1',
    '42 个计分交互，六维各 7 个；用于更稳定地定位学习起点，不作为高阶认证。',
    42,
    'candidate',
    '{"form":"A-extended","evidence_grade":"screening","dimensions":["M","F","T","V","C","S"],"items_per_dimension":7}'::jsonb
  ),
  (
    'ai-usage-style-v1.1-beta',
    'ai-usage-style-v1',
    'ai-style-item-bank-1.0.0',
    'ai-style-scoring-1.1.0',
    'personality',
    'AI 使用风格扩展画像 Beta',
    '32 道七点量表计分题与 4 道不计分行为权衡题；四条连续偏好轴各有 8 个计分证据。',
    36,
    'candidate',
    '{"scored_item_count":32,"experimental_item_count":4,"axes":["ES","CO","RA","PD"],"items_per_axis":8,"construct":"usage_style_not_capability","public_label":"beta"}'::jsonb
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
