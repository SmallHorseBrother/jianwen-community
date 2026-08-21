import { supabase } from '../../lib/supabase';
import type {
  LearningDashboard,
  LearningProject,
  LearningStepDetail,
  ProjectFeedback,
} from './types';

export async function ensureLearningSession() {
  const { data: current } = await supabase.auth.getSession();
  if (current.session) return current.session;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.session) throw new Error(error?.message || '暂时无法创建游客身份');
  return data.session;
}

async function invokeLearning<T>(body: Record<string, unknown>): Promise<T> {
  await ensureLearningSession();
  const { data, error } = await supabase.functions.invoke('ai-learning-engine', { body });
  if (error) {
    let message = error.message || '学习服务暂时不可用';
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: unknown };
        if (typeof payload.error === 'string' && payload.error.trim()) message = payload.error;
      } catch {
        // Keep the SDK message for non-JSON responses.
      }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export const aiLearningService = {
  dashboard: () => invokeLearning<LearningDashboard>({ action: 'dashboard' }),
  enroll: () => invokeLearning<{ enrollment: { id: string } }>({ action: 'enroll' }),
  step: (stepId: string) => invokeLearning<LearningStepDetail>({ action: 'step', step_id: stepId }),
  completeStep: (stepId: string, response: string) => invokeLearning<{ completed: boolean; next_position: number }>({
    action: 'complete-step', step_id: stepId, response,
  }),
  submitProject: (submissionText: string, submissionUrl?: string) => invokeLearning<{
    project: { id: string; status: string };
    feedback: ProjectFeedback;
    feedback_source: 'llm' | 'fallback';
  }>({ action: 'submit-project', submission_text: submissionText, submission_url: submissionUrl || null }),
  submitMastery: (responses: Array<{ item_id: string; value: string }>) => invokeLearning<{
    mastery_score: number;
    baseline_score: number | null;
    result: { label: string; note: string; correct: number; total: number };
  }>({ action: 'submit-mastery', responses }),
  projects: () => invokeLearning<{ projects: LearningProject[] }>({ action: 'projects' }),
};
