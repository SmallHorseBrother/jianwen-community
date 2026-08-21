import { useCallback, useEffect, useState } from 'react';
import { aiLearningService } from './service';
import type { LearningDashboard } from './types';

export function useLearningDashboard() {
  const [data, setData] = useState<LearningDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await aiLearningService.dashboard());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '学习数据加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  return { data, error, loading, refresh };
}
