import { apiFetch } from '@/utils/apiFetch';
import type {
  CreateTransferModulePayload,
  InventoryMovementsListResponse,
  InventoryMovementRow,
} from '@/types/transfer';

/** Traslados + entradas por compra (módulo Traslados) */
export async function fetchTransferMovements(params?: {
  skip?: number;
  take?: number;
}): Promise<InventoryMovementsListResponse> {
  const search = new URLSearchParams();
  search.set('types', 'TRANSFER,PURCHASE');
  if (params?.skip != null) search.set('skip', String(params.skip));
  if (params?.take != null) search.set('take', String(params.take));
  const q = search.toString();
  return apiFetch<InventoryMovementsListResponse>(`/inventory-movements?${q}`);
}

export async function createInventoryMovementRequest(
  payload: CreateTransferModulePayload
): Promise<InventoryMovementRow> {
  return apiFetch<InventoryMovementRow>('/inventory-movements', {
    method: 'POST',
    json: payload,
  });
}

export async function fetchInventoryMovementById(
  id: number
): Promise<InventoryMovementRow> {
  return apiFetch<InventoryMovementRow>(`/inventory-movements/${id}`);
}

export async function patchTransferRequest(
  id: number,
  body: {
    notes?: string | null;
    quantity?: number;
  }
): Promise<InventoryMovementRow> {
  return apiFetch<InventoryMovementRow>(`/inventory-movements/${id}`, {
    method: 'PATCH',
    json: body,
  });
}

export async function deleteTransferRequest(id: number): Promise<void> {
  await apiFetch<undefined>(`/inventory-movements/${id}`, { method: 'DELETE' });
}
