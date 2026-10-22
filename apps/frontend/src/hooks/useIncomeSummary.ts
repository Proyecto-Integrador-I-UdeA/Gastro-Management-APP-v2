import { useEffect, useState } from 'react';
import { fetchIncomeSummary } from '@/lib/finance/incomeApi';
import { previousRange } from '@/utils/finance/dateRanges';
import type { IncomeSummaryQuery, IncomeSummaryResponse } from '@/types/finance/income';

export function useIncomeSummary(query: IncomeSummaryQuery) {
  const [data, setData] = useState<IncomeSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { from, to, recognition, granularity, includeService } = query;

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchIncomeSummary({ from, to, recognition, granularity, includeService })
      .then(result => { if (!cancelled) setData(result); })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Error cargando ingresos');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, recognition, granularity, includeService]);

  return { data, loading, error };
}

export function useIncomeComparison(query: IncomeSummaryQuery) {
  const [current, setCurrent] = useState<IncomeSummaryResponse | null>(null);
  const [previous, setPrevious] = useState<IncomeSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { from, to, recognition, granularity, includeService } = query;

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    const prev = previousRange({ from, to });

    Promise.all([
      fetchIncomeSummary({ from, to, recognition, granularity, includeService }),
      fetchIncomeSummary({ from: prev.from, to: prev.to, recognition, granularity, includeService }),
    ])
      .then(([cur, prevRes]) => {
        if (cancelled) return;
        setCurrent(cur);
        setPrevious(prevRes);
      })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Error cargando ingresos');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [from, to, recognition, granularity, includeService]);

  return { current, previous, loading, error };
}