import { apiFetch } from '@/utils/apiFetch';
import type { WarehouseSummary } from '@/types/transfer';

export async function fetchWarehouses(activeOnly = true): Promise<WarehouseSummary[]> {
  const q = activeOnly ? '?active=true' : '';
  const data = await apiFetch<unknown>(`/warehouses${q}`);
  if (!Array.isArray(data)) return [];
  return data as WarehouseSummary[];
}

/** Todas las bodegas (activas e inactivas), p. ej. pantalla de administración */
export async function fetchAllWarehouses(): Promise<WarehouseSummary[]> {
  return fetchWarehouses(false);
}

export type CreateWarehousePayload = {
  name: string;
  description?: string | null;
  active?: boolean;
  isMain?: boolean;
};

export async function createWarehouseRequest(
  payload: CreateWarehousePayload
): Promise<WarehouseSummary> {
  return apiFetch<WarehouseSummary>('/warehouses', {
    method: 'POST',
    json: {
      name: payload.name,
      description: payload.description ?? null,
      active: payload.active ?? true,
      isMain: payload.isMain ?? false,
    },
  });
}

export type UpdateWarehousePayload = {
  name?: string;
  description?: string | null;
  active?: boolean;
  isMain?: boolean;
};

export async function updateWarehouseRequest(
  id: number,
  payload: UpdateWarehousePayload
): Promise<WarehouseSummary> {
  return apiFetch<WarehouseSummary>(`/warehouses/${id}`, {
    method: 'PUT',
    json: payload,
  });
}

export async function fetchWarehouseById(id: number): Promise<WarehouseSummary> {
  return apiFetch<WarehouseSummary>(`/warehouses/${id}`);
}
