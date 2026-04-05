import { apiFetch } from '@/utils/apiFetch';
import type { Supplier } from '@/types/supplier';
import { normalizeSupplierFromApi } from '@/lib/normalizeSupplier';

export type SupplierWritePayload = {
  internalCode: string;
  name: string;
  taxId: string;
  phone: string;
  address: string;
  contactPerson: string;
};

/** Used by product forms — only active suppliers */
export async function fetchSuppliers(): Promise<Supplier[]> {
  const all = await fetchSuppliersList();
  return all.filter((s) => s.active);
}

export async function fetchSuppliersList(): Promise<Supplier[]> {
  const data = await apiFetch<unknown[]>('/suppliers');
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => normalizeSupplierFromApi(row))
    .filter((s): s is Supplier => s != null);
}

export async function fetchSupplierById(id: number): Promise<Supplier> {
  const data = await apiFetch<unknown>(`/suppliers/${id}`);
  const s = normalizeSupplierFromApi(data);
  if (!s) throw new Error('Invalid supplier response');
  return s;
}

export async function createSupplierRequest(payload: SupplierWritePayload): Promise<Supplier> {
  const data = await apiFetch<unknown>('/suppliers', {
    method: 'POST',
    json: payload,
  });
  const s = normalizeSupplierFromApi(data);
  if (!s) throw new Error('Invalid supplier response');
  return s;
}

export async function updateSupplierRequest(
  id: number,
  payload: Partial<SupplierWritePayload>
): Promise<Supplier> {
  const data = await apiFetch<unknown>(`/suppliers/${id}`, {
    method: 'PUT',
    json: payload,
  });
  const s = normalizeSupplierFromApi(data);
  if (!s) throw new Error('Invalid supplier response');
  return s;
}

export async function inactivateSupplierRequest(id: number): Promise<void> {
  await setSupplierActiveRequest(id, false);
}

export async function setSupplierActiveRequest(
  id: number,
  active: boolean
): Promise<void> {
  await apiFetch<undefined>(`/suppliers/${id}`, {
    method: 'PATCH',
    json: { active },
  });
}

export async function deleteSupplierRequest(id: number): Promise<void> {
  await apiFetch<undefined>(`/suppliers/${id}`, { method: 'DELETE' });
}
