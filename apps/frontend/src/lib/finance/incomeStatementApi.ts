import { apiFetch } from '@/utils/apiFetch';
import type {
  IncomeStatementSummaryQuery,
  IncomeStatementSummaryResponse,
} from '@/types/finance/incomeStatement';

export async function fetchIncomeStatementSummary(
  query: IncomeStatementSummaryQuery,
): Promise<IncomeStatementSummaryResponse> {
  const params = new URLSearchParams({
    from: query.from,
    to: query.to,
    granularity: query.granularity,
  });
  return apiFetch<IncomeStatementSummaryResponse>(
    `/finance/income-statement/summary?${params.toString()}`,
  );
}