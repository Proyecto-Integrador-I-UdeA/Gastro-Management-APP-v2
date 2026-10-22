import { useEffect, useState } from 'react';
import { fetchIncomeStatementSummary } from '@/lib/finance/incomeStatementApi';
import { previousRange } from '@/utils/finance/dateRanges';
import type {
  IncomeStatementSummaryQuery,
  IncomeStatementSummaryResponse,
} from '@/types/finance/incomeStatement';

export function useIncomeStatement(query: IncomeStatementSummaryQuery) {
  const [data, setData] = useState<IncomeStatementSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { from, to, granularity } = query;

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchIncomeStatementSummary({ from, to, granularity })
      .then(result => { if (!cancelled) setData(result); })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Error cargando estado de resultados');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, granularity]);

  return { data, loading, error };
}

export function useIncomeStatementComparison(query: IncomeStatementSummaryQuery) {
  const [current, setCurrent] = useState<IncomeStatementSummaryResponse | null>(null);
  const [previous, setPrevious] = useState<IncomeStatementSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { from, to, granularity } = query;

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    const prev = previousRange({ from, to });

    Promise.all([
      fetchIncomeStatementSummary({ from, to, granularity }),
      fetchIncomeStatementSummary({ from: prev.from, to: prev.to, granularity }),
    ])
      .then(([cur, prevRes]) => {
        if (cancelled) return;
        setCurrent(cur);
        setPrevious(prevRes);
      })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Error cargando estado de resultados');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [from, to, granularity]);

  return { current, previous, loading, error };
}