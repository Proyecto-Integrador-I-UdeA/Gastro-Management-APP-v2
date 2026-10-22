import { apiFetch } from '@/utils/apiFetch';
import type {
  FinanceDashboardQuery,
  FinanceDashboardResponse,
} from '@/types/finance/financeDashboard';

export async function fetchFinanceDashboard(
  query: FinanceDashboardQuery,
): Promise<FinanceDashboardResponse> {
  const params = new URLSearchParams({
    from: query.from,
    to: query.to,
  });
  return apiFetch<FinanceDashboardResponse>(`/finance/dashboard/summary?${params.toString()}`);
}