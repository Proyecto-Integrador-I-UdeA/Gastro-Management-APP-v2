import { apiFetch } from '@/utils/apiFetch';
import type {
  CreateTransferModulePayload,
  InventoryMovementsListResponse,
  InventoryMovementRow,
  InventoryMovementType,
} from '@/types/transfer';

export async function fetchInventoryMovements(params?: {
  skip?: number;
  take?: number;
  types?: InventoryMovementType[];
}): Promise<InventoryMovementsListResponse> {
  const search = new URLSearchParams();
  if (params?.types?.length) search.set('types', params.types.join(','));
  if (params?.skip != null) search.set('skip', String(params.skip));
  if (params?.take != null) search.set('take', String(params.take));
  const q = search.toString();
  return apiFetch<InventoryMovementsListResponse>(`/inventory-movements?${q}`);
}

/** Compatibilidad para consumidores anteriores del módulo de traslados. */
export const fetchTransferMovements = fetchInventoryMovements;

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
