import { useEffect, useState } from 'react';
import { fetchFinanceDashboard } from '@/lib/finance/financeDashboardApi';
import type {
  FinanceDashboardQuery,
  FinanceDashboardResponse,
} from '@/types/finance/financeDashboard';

export function useFinanceDashboard(query: FinanceDashboardQuery) {
  const [data, setData] = useState<FinanceDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { from, to } = query;

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchFinanceDashboard({ from, to })
      .then(result => { if (!cancelled) setData(result); })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Error cargando dashboard');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to]);

  return { data, loading, error };
}