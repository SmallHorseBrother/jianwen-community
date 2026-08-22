export type LearningGoal = 'office' | 'content' | 'learning' | 'product' | 'programming';
export type DimensionCode = 'M' | 'F' | 'T' | 'V' | 'C' | 'S';

export type LearningStepSummary = {
  id: string;
  day_no: number;
  position: number;
  step_type: 'lesson' | 'practice' | 'project' | 'mastery_check';
  title: string;
  summary: string;
  module_code: string | null;
  estimated_minutes: number;
  status: 'not_started' | 'in_progress' | 'completed';
  locked: boolean;
};

export type LearningDashboard = {
  account: { anonymous: boolean; can_enroll: boolean };
  assessment: null | {
    id: string;
    ability_level: number;
    level_title: string;
    total_score: number | null;
    learning_goal: LearningGoal | null;
    dimension_scores: Partial<Record<DimensionCode, number>>;
    created_at: string;
  };
  needs_assessment: boolean;
  recommendation: null | {
    gate: { dimension: DimensionCode; label: string; score: number; module_code: string; reason: string };
    lesson: { content_unit_id: string; title: string };
    project: { content_unit_id: string; task_code: string; title: string; goal_label: string };
  };
  path: {
    id: string;
    title: string;
    summary: string;
    duration_days: number;
    enrolled: boolean;
    enrollment_status: 'active' | 'completed' | 'paused' | 'cancelled' | null;
    current_position: number;
    completed_count: number;
    steps: LearningStepSummary[];
  };
  route_library: Array<{
    level: number;
    title: string;
    group_code: 'beginner' | 'application' | 'advanced';
    gate_config: Record<string, unknown>;
    recommended: boolean;
    modules: Array<{
      code: string;
      title: string;
      module_type: string;
      learning_outcome: string;
      status: string;
    }>;
  }>;
  group: null | {
    route_level: 'starter' | 'application' | 'practice';
    access_status: 'pending_payment' | 'active' | 'revoked';
    display_id: string | null;
    group_name: string | null;
    description: string | null;
  };
};

export type PublicQuestion = {
  id: string;
  prompt: string;
  options: Array<{ id: string; text: string }>;
};

export type LearningStepDetail = {
  step: {
    id: string;
    day_no: number;
    position: number;
    content_unit_id: string;
    step_type: LearningStepSummary['step_type'];
    config: {
      response_required?: boolean;
      minimum_characters?: number;
      response_prompt?: string;
      questions?: PublicQuestion[];
    };
    unit: {
      id: string;
      module_code: string;
      title: string;
      summary: string;
      body_markdown: string;
      estimated_minutes: number;
      content_kind: LearningStepSummary['step_type'];
      metadata: {
        response_prompt?: string;
        materials?: Array<{ name: string; content: string }>;
      };
    };
  };
  preview: boolean;
  enrollment_id: string | null;
};

export type ProjectFeedback = {
  total_score: number;
  rubric_scores: Record<string, number>;
  overview: string;
  strengths: string[];
  improvements: string[];
  next_action: string;
};

export type LearningProject = {
  id: string;
  task_code: string;
  learning_goal: LearningGoal;
  status: string;
  rubric_scores: Record<string, number>;
  feedback_summary: string | null;
  submitted_at: string;
  submission_url: string | null;
  feedback: null | {
    status: string;
    model: string | null;
    feedback_payload: ProjectFeedback;
    created_at: string;
  };
};
