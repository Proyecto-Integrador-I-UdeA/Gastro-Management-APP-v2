import { useEffect, useState } from 'react';
import { fetchProfitabilityByProduct } from '@/lib/finance/profitabilityByProductApi';
import type {
  ProfitabilityByProductQuery,
  ProfitabilityByProductResponse,
} from '@/types/finance/profitabilityByProduct';

export function useProfitabilityByProduct(query: ProfitabilityByProductQuery) {
  const [data, setData] = useState<ProfitabilityByProductResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { from, to, categoryId, search } = query;

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchProfitabilityByProduct({ from, to, categoryId, search })
      .then(result => { if (!cancelled) setData(result); })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Error cargando rentabilidad por producto');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, categoryId, search]);

  return { data, loading, error };
}