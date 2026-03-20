import { apiFetch } from '@/utils/apiFetch';
import type { ProductSupplier } from '@/types/product';
import { normalizeSupplierFromApi } from '@/lib/normalizeProduct';

export async function fetchSuppliers(): Promise<ProductSupplier[]> {
  const data = await apiFetch<unknown[]>('/suppliers');
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => normalizeSupplierFromApi(row))
    .filter((s): s is ProductSupplier => s != null);
}
