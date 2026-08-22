select
  to_regclass('public.ai_specialty_exam_sessions') is not null as sessions_table_ok,
  to_regclass('public.ai_specialty_exam_responses') is not null as responses_table_ok,
  (select count(*) from public.ai_assessment_items where item_bank_version = 'ai-six-paper-bank-1.0.0-candidate') as six_paper_assets,
  (select jsonb_object_agg(paper_code, item_count order by paper_code)
   from (
     select paper_code, count(*) as item_count
     from public.ai_assessment_items
     where item_bank_version = 'ai-six-paper-bank-1.0.0-candidate'
     group by paper_code
   ) counts) as assets_by_paper,
  (select count(*) from public.ai_assessment_instruments where id = 'first-ai-capability-exam-2026-v1' and status = 'active') as formal_baseline_preserved;

-- Expected: sessions/responses true; six_paper_assets 261;
-- assets_by_paper {A:50,B:50,C:50,D:50,E:50,F:11}; formal_baseline_preserved 1.
