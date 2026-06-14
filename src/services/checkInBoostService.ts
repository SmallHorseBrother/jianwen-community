import { supabase } from '../lib/supabase';
import type { UserCheckInStats } from './checkInService';

export type CheckInBoostLineSource = 'deepseek' | 'fallback';

export interface CheckInBoostAchievement {
  label: string;
  value: string;
}

export interface GenerateCheckInBoostLineParams {
  content: string;
  achievements: CheckInBoostAchievement[];
  themeLabel: string;
  completedCount: number;
  stats: UserCheckInStats;
  nickname: string;
  groupName: string;
}

export interface CheckInBoostLineResult {
  boostLine: string;
  source: CheckInBoostLineSource;
  reason?: string;
}

export async function generateCheckInBoostLine(
  params: GenerateCheckInBoostLineParams,
): Promise<CheckInBoostLineResult> {
  const { data, error } = await supabase.functions.invoke('checkin-boost-line', {
    body: params,
  });

  if (error) throw error;

  const boostLine = typeof data?.boostLine === 'string' ? data.boostLine.trim() : '';
  if (!boostLine) {
    throw new Error('No check-in boost line returned');
  }

  return {
    boostLine,
    source: data?.source === 'deepseek' ? 'deepseek' : 'fallback',
    reason: typeof data?.reason === 'string' ? data.reason : undefined,
  };
}
