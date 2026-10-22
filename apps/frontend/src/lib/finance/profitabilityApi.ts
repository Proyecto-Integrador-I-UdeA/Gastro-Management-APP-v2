import { apiFetch } from '@/utils/apiFetch';
import type {
  ProfitabilitySummaryQuery,
  ProfitabilitySummaryResponse,
} from '@/types/finance/profitability';

export async function fetchProfitabilitySummary(
  query: ProfitabilitySummaryQuery,
): Promise<ProfitabilitySummaryResponse> {
  const params = new URLSearchParams({
    from: query.from,
    to: query.to,
    granularity: query.granularity,
  });
  return apiFetch<ProfitabilitySummaryResponse>(
    `/finance/profitability/summary?${params.toString()}`,
  );
}