export type SpecialtyPaperCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type SpecialtyExamMode = 'standard' | 'full' | 'practical';

export type SpecialtyPaperCatalog = {
  code: SpecialtyPaperCode;
  title: string;
  short: string;
  minutes: { standard: number; full: number };
  item_count: number;
  status: 'practice_beta';
  price_cents: number;
  modes: Array<{ id: SpecialtyExamMode; label: string; count: number }>;
  completed_attempts: number;
  latest: null | {
    id: string;
    mode: SpecialtyExamMode;
    status: 'open' | 'completed' | 'expired';
    objective_score: number;
    objective_max_score: number;
    result: Record<string, unknown>;
    created_at: string;
  };
};

export type PracticalTaskCatalog = {
  id: string;
  title: string;
  summary: string;
  deliverables: string[];
  completed: boolean;
};

export type ExamCatalog = {
  beta_notice: string;
  comprehensive: { id: string; title: string; item_count: number; status: string; price_cents: number; purpose: string };
  style: { id: string; title: string; item_count: number; status: string; price_cents: number; purpose: string };
  papers: SpecialtyPaperCatalog[];
  f_tasks: PracticalTaskCatalog[];
};

export type SpecialtyExamItem = {
  id: string;
  paper_code: SpecialtyPaperCode;
  unit_code: string;
  unit_title: string;
  item_type: 'choice' | 'multi_select' | 'ordering' | 'open';
  target_level: number;
  prompt: string;
  options: null | Array<{ id: string; text: string }>;
  code: string | null;
};

export type SpecialtyExamSession = {
  id: string;
  paper_code: SpecialtyPaperCode;
  mode: SpecialtyExamMode;
  status: 'open' | 'completed' | 'expired';
  expires_at: string;
  presentation: {
    paper: { code: SpecialtyPaperCode; title: string; short: string };
    mode: SpecialtyExamMode;
    item_count?: number;
    items?: SpecialtyExamItem[];
    task?: PracticalTaskCatalog;
  };
  result?: SpecialtyExamResult;
};

export type SpecialtyExamReview = {
  item_id: string;
  item_type: SpecialtyExamItem['item_type'];
  prompt: string;
  user_answer: string | string[];
  score: number | null;
  max_score: number | null;
  standard_answer: string | null;
  rationale: string;
  rubric: string | null;
  reference_answer: string | null;
  module_code: string | null;
};

export type SpecialtyExamResult = {
  paper_code: SpecialtyPaperCode;
  mode?: SpecialtyExamMode;
  objective_score?: number;
  objective_max_score?: number;
  percent?: number;
  objective_items?: number;
  self_review_items?: number;
  label?: string;
  reviews?: SpecialtyExamReview[];
  task_id?: string;
  score?: number;
  feedback?: {
    total_score: number;
    overview: string;
    strengths: string[];
    improvements: string[];
    next_action: string;
    source: 'llm' | 'fallback';
  };
  formal_level_effect: false;
};
