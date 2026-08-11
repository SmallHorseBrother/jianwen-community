select
  (select count(*) from public.ai_assessment_items where item_bank_version = 'first-ai-exam-bank-1.0.0') as bank_count,
  (select count(distinct dimension_code) from public.ai_assessment_items where item_bank_version = 'first-ai-exam-bank-1.0.0') as dimension_count,
  (select jsonb_object_agg(item_type, item_count) from (
    select item_type, count(*) as item_count
    from public.ai_assessment_items
    where item_bank_version = 'first-ai-exam-bank-1.0.0'
    group by item_type
  ) kinds) as kind_counts,
  (select jsonb_object_agg(dimension_code, item_count) from (
    select dimension_code, count(*) as item_count
    from public.ai_assessment_items
    where item_bank_version = 'first-ai-exam-bank-1.0.0'
    group by dimension_code
  ) dimensions) as dimension_counts,
  (select to_jsonb(instrument) from (
    select id, status, item_count, config ->> 'pool_size' as pool_size, config ->> 'scored_items' as scored_items
    from public.ai_assessment_instruments
    where id = 'first-ai-capability-exam-2026-v1'
  ) instrument) as instrument;
