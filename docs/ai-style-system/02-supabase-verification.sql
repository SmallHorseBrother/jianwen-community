-- Run after 20260810102109_assessment_item_bank_sampling_v1_1.sql.
select
  to_regclass('public.ai_style_responses') is not null as style_responses_table_ok,
  to_regclass('public.ai_style_items') is not null as style_items_table_ok,
  to_regclass('public.ai_assessment_sessions') is not null as assessment_sessions_table_ok,
  exists (
    select 1
    from public.ai_assessment_instruments
    where id = 'pacf-quick-v1.1-random'
      and framework_version = 'pacf-1.0.0'
      and item_count = 42
  ) as expanded_capability_instrument_ok,
  exists (
    select 1
    from public.ai_assessment_instruments
    where id = 'ai-usage-style-v1.1-random-beta'
      and framework_version = 'ai-usage-style-v1'
      and item_count = 36
  ) as style_instrument_ok,
  (
    select count(*) = 120
    from public.ai_assessment_items
    where item_bank_version = 'pacf-item-bank-1.1.0'
      and status = 'active'
  ) as pacf_full_bank_ok,
  (
    select count(*) = 60
    from public.ai_style_items
    where item_bank_version = 'ai-style-item-bank-1.1.0'
      and status = 'active'
  ) as style_full_bank_ok,
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ai_assessment_attempts'::regclass
      and conname = 'ai_assessment_attempts_personality_code_check'
  ) as personality_code_constraint_ok,
  (
    select count(*)
    from public.ai_assessment_attempts
    where kind = 'personality'
      and framework_version = 'ai-personality-v1'
  ) as preserved_legacy_personality_count,
  (
    select count(*)
    from public.ai_assessment_attempts
    where kind = 'personality'
      and framework_version = 'ai-usage-style-v1'
  ) as new_style_attempt_count,
  (
    select count(*)
    from public.ai_style_responses
  ) as new_style_response_count;
