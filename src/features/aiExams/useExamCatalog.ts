import { useCallback, useEffect, useState } from 'react';
import { aiExamService } from './service';
import type { ExamCatalog } from './types';

export function useExamCatalog() {
  const [data, setData] = useState<ExamCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await aiExamService.catalog()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : '考试目录加载失败'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { data, loading, error, refresh };
}
