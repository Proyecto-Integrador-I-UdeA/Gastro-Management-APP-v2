import { apiFetch } from '@/utils/apiFetch';
import type { InventoryListRow } from '@/types/inventory';

export async function fetchInventories(params?: {
  warehouseId?: number;
  productId?: number;
}): Promise<InventoryListRow[]> {
  const search = new URLSearchParams();
  if (params?.warehouseId != null) search.set('warehouseId', String(params.warehouseId));
  if (params?.productId != null) search.set('productId', String(params.productId));
  const q = search.toString();
  const path = q ? `/inventories?${q}` : '/inventories';
  const data = await apiFetch<unknown>(path);
  if (!Array.isArray(data)) return [];
  return data as InventoryListRow[];
}
