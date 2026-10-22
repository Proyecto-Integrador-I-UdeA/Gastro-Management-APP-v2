import { useEffect, useState } from 'react';
import { fetchProfitabilitySummary } from '@/lib/finance/profitabilityApi';
import { previousRange } from '@/utils/finance/dateRanges';
import type {
  ProfitabilitySummaryQuery,
  ProfitabilitySummaryResponse,
} from '@/types/finance/profitability';

export function useProfitability(query: ProfitabilitySummaryQuery) {
  const [data, setData] = useState<ProfitabilitySummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { from, to, granularity } = query;

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchProfitabilitySummary({ from, to, granularity })
      .then(result => { if (!cancelled) setData(result); })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Error cargando rentabilidad');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, granularity]);

  return { data, loading, error };
}

export function useProfitabilityComparison(query: ProfitabilitySummaryQuery) {
  const [current, setCurrent] = useState<ProfitabilitySummaryResponse | null>(null);
  const [previous, setPrevious] = useState<ProfitabilitySummaryResponse | null>(null);
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
      fetchProfitabilitySummary({ from, to, granularity }),
      fetchProfitabilitySummary({ from: prev.from, to: prev.to, granularity }),
    ])
      .then(([cur, prevRes]) => {
        if (cancelled) return;
        setCurrent(cur);
        setPrevious(prevRes);
      })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Error cargando rentabilidad');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [from, to, granularity]);

  return { current, previous, loading, error };
}