import { apiFetch } from '@/utils/apiFetch';
import type {
  ProfitabilityByProductQuery,
  ProfitabilityByProductResponse,
} from '@/types/finance/profitabilityByProduct';

export async function fetchProfitabilityByProduct(
  query: ProfitabilityByProductQuery,
): Promise<ProfitabilityByProductResponse> {
  const params = new URLSearchParams({
    from: query.from,
    to: query.to,
  });
  if (query.categoryId !== undefined) params.set('categoryId', String(query.categoryId));
  if (query.search) params.set('search', query.search);
  return apiFetch<ProfitabilityByProductResponse>(
    `/finance/profitability/by-product?${params.toString()}`,
  );
}