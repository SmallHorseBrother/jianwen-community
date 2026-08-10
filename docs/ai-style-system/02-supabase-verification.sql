-- Run after 20260810090830_ai_usage_style_v1.sql.
select
  to_regclass('public.ai_style_responses') is not null as style_responses_table_ok,
  exists (
    select 1
    from public.ai_assessment_instruments
    where id = 'pacf-quick-v1.1-candidate'
      and framework_version = 'pacf-1.0.0'
      and item_count = 42
  ) as expanded_capability_instrument_ok,
  exists (
    select 1
    from public.ai_assessment_instruments
    where id = 'ai-usage-style-v1.1-beta'
      and framework_version = 'ai-usage-style-v1'
      and item_count = 36
  ) as style_instrument_ok,
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
