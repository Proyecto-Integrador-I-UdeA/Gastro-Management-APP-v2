import { apiFetch } from '@/utils/apiFetch';
import type { IncomeSummaryQuery, IncomeSummaryResponse } from '@/types/finance/income';

export async function fetchIncomeSummary(
  query: IncomeSummaryQuery,
): Promise<IncomeSummaryResponse> {
  const params = new URLSearchParams({
    from: query.from,
    to: query.to,
    recognition: query.recognition,
    granularity: query.granularity,
    includeService: String(query.includeService),
  });
  return apiFetch<IncomeSummaryResponse>(`/finance/income/summary?${params.toString()}`);
}