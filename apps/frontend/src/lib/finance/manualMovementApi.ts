import { apiFetch } from '@/utils/apiFetch';
import type {
  CreateManualMovementInput,
  ListManualMovementsQuery,
  ManualMovement,
  ManualMovementReferences,
  ManualMovementSummary,
  PosSalesOfDay,
} from '@/types/finance/manualMovement';

// ⚠️ IMPORTANTE: pasar el Content-Type explícito en POST/PUT.
// El `apiFetch` del proyecto no siempre lo propaga bien y el backend
// recibe `text/plain` → express.json() no parsea el body.
const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export async function fetchManualMovements(
  query: ListManualMovementsQuery,
): Promise<{ movements: ManualMovement[] }> {
  const params = new URLSearchParams();
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.kind) params.set('kind', query.kind);
  if (query.status) params.set('status', query.status);
  if (query.paymentMethodId) params.set('paymentMethodId', String(query.paymentMethodId));
  if (query.search) params.set('search', query.search);
  return apiFetch<{ movements: ManualMovement[] }>(`/finance/movements?${params.toString()}`);
}

export async function fetchManualMovementSummary(
  date?: string,
): Promise<ManualMovementSummary> {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  return apiFetch<ManualMovementSummary>(`/finance/movements/summary?${params.toString()}`);
}

export async function fetchManualMovementReferences(): Promise<ManualMovementReferences> {
  return apiFetch<ManualMovementReferences>('/finance/movements/references');
}

export async function createManualMovement(
  input: CreateManualMovementInput,
): Promise<ManualMovement> {
  const body = JSON.stringify(input);
  console.log('[manualMovementApi] POST body:', body);
  return apiFetch<ManualMovement>('/finance/movements', {
    method: 'POST',
    headers: JSON_HEADERS,
    body,
  });
}

export async function confirmManualMovement(
  id: number,
): Promise<ManualMovement> {
  console.log('[manualMovementApi] POST confirm for id:', id);
  return apiFetch<ManualMovement>(`/finance/movements/${id}/confirm`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({}),
  });
}

export async function cancelManualMovement(
  id: number,
  reason: string,
): Promise<ManualMovement> {
  const body = JSON.stringify({ reason });
  console.log('[manualMovementApi] POST cancel body:', body);
  return apiFetch<ManualMovement>(`/finance/movements/${id}/cancel`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body,
  });
}

// ─── POS sales del día (para HU1: "no digitar ventas POS") ────────────────

export async function fetchPosSalesOfDay(date: string): Promise<PosSalesOfDay> {
  const params = new URLSearchParams({
    from: date,
    to: date,
    recognition: 'cash',
    granularity: 'day',
    includeService: 'false',
  });
  const response = await apiFetch<{
    currencies: Array<{
      currency: string;
      totals: { totalCollected: string; orderCount: number };
      byPaymentMethod?: Record<string, string>;
    }>;
  }>(`/finance/income/summary?${params.toString()}`);

  const cop = response.currencies.find(c => c.currency === 'COP') ?? response.currencies[0];
  if (!cop) {
    return { cashSalesAmount: '0.00', totalCollected: '0.00', orderCount: 0 };
  }
  return {
    cashSalesAmount: cop.byPaymentMethod?.CASH ?? '0.00',
    totalCollected: cop.totals.totalCollected,
    orderCount: cop.totals.orderCount,
  };
}