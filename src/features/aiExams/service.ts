import { supabase } from '../../lib/supabase';
import { ensureLearningSession } from '../aiLearning/service';
import type { ExamCatalog, SpecialtyExamMode, SpecialtyExamResult, SpecialtyExamSession, SpecialtyPaperCode } from './types';

async function invokeExam<T>(body: Record<string, unknown>): Promise<T> {
  await ensureLearningSession();
  const { data, error } = await supabase.functions.invoke('ai-specialty-exam-engine', { body });
  if (error) {
    let message = error.message || '专项考试服务暂时不可用';
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: unknown };
        if (typeof payload.error === 'string' && payload.error.trim()) message = payload.error;
      } catch {
        // Keep the SDK message for a non-JSON error response.
      }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export const aiExamService = {
  catalog: () => invokeExam<ExamCatalog>({ action: 'catalog' }),
  start: (paperCode: SpecialtyPaperCode, mode: SpecialtyExamMode, taskId?: string) => invokeExam<SpecialtyExamSession>({
    action: 'start', paper_code: paperCode, mode, task_id: taskId || null,
  }),
  session: (sessionId: string) => invokeExam<{ session: SpecialtyExamSession; material_url: string | null }>({
    action: 'session', session_id: sessionId,
  }),
  submit: (sessionId: string, responses: Array<{ item_id: string; value: string | string[] }>) => invokeExam<{
    session: SpecialtyExamSession;
    result: SpecialtyExamResult;
  }>({ action: 'submit', session_id: sessionId, responses }),
};
