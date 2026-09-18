import { apiFetch } from '@/utils/apiFetch';
import type { SalesAnalyticsPeriod, SalesAnalyticsResponse } from '@/types/salesAnalytics';

export async function fetchSalesAnalytics(params: {
  period: SalesAnalyticsPeriod;
  date?: string;
  week?: string;
  month?: string;
  year?: string;
  from?: string;
  to?: string;
  menuItemId?: number;
  categoryId?: number;
}) {
  const query = new URLSearchParams({ period: params.period });
  if (params.period === 'day' && params.date) query.set('date', params.date);
  if (params.period === 'week' && params.week) query.set('week', params.week);
  if (params.period === 'month' && params.month) query.set('month', params.month);
  if (params.period === 'year' && params.year) query.set('year', params.year);
  if (params.period === 'custom' && params.from && params.to) {
    query.set('from', params.from);
    query.set('to', params.to);
  }
  if (params.menuItemId !== undefined) query.set('menuItemId', String(params.menuItemId));
  if (params.categoryId !== undefined) query.set('categoryId', String(params.categoryId));
  return apiFetch<SalesAnalyticsResponse>(`/sales/analytics?${query.toString()}`);
}
