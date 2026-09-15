import { apiFetch } from '@/utils/apiFetch';
import type { CountReferences, PhysicalCount, PhysicalCountReason, PhysicalCountStatus } from '@/types/inventoryPhysicalCount';

export type CountLineInput = { productId: number; countedQuantity: number | null };
export const fetchPhysicalCounts = (status?: PhysicalCountStatus) => apiFetch<PhysicalCount[]>(`/inventory-counts${status ? `?status=${status}` : ''}`);
export const fetchPhysicalCount = (id: number) => apiFetch<PhysicalCount>(`/inventory-counts/${id}`);
export const fetchCountReferences = (warehouseId?: number) => apiFetch<CountReferences>(`/inventory-counts/references${warehouseId ? `?warehouseId=${warehouseId}` : ''}`);
export const createPhysicalCount = (body: { warehouseId: number; reason: PhysicalCountReason; notes: string | null; items: CountLineInput[] }) => apiFetch<PhysicalCount>('/inventory-counts', { method: 'POST', json: body });
export const updatePhysicalCount = (id: number, body: { reason: PhysicalCountReason; notes: string | null; items: CountLineInput[] }) => apiFetch<PhysicalCount>(`/inventory-counts/${id}`, { method: 'PUT', json: body });
export const postPhysicalCount = (id: number) => apiFetch<PhysicalCount>(`/inventory-counts/${id}/post`, { method: 'POST', json: {} });
export const cancelPhysicalCount = (id: number) => apiFetch<PhysicalCount>(`/inventory-counts/${id}/cancel`, { method: 'POST', json: {} });
export const refreshPhysicalCount = (id: number) => apiFetch<PhysicalCount>(`/inventory-counts/${id}/refresh`, { method: 'POST', json: {} });
