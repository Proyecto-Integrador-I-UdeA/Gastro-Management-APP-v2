import { apiFetch } from '@/utils/apiFetch';
import type { Product } from '@/types/product';
import { normalizeProductFromApi } from '@/lib/normalizeProduct';

export type ProductWritePayload = {
  internalCode?: string;
  name: string;
  category: string;
  isIngredient: boolean;
  isSupply: boolean;
  isFinishedProduct: boolean;
  presentation: string;
  unitOfMeasure: string;
  inputUnit: string;
  inputUnitQuantity: number;
  minStock: number;
  maxStock: number;
  supplierId: number;
  unitCost: number;

  catalogId?: number | null;

  caloriesPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
  proteinPer100g?: number;
  sugarPer100g?: number;
  sodiumPer100g?: number;
};

export async function fetchProductsWithSuppliers(
  supplierId?: number | null
): Promise<Product[]> {
  const params = new URLSearchParams({ include: 'supplier' });
  if (supplierId != null && !Number.isNaN(supplierId)) {
    params.set('supplierId', String(supplierId));
  }
  const data = await apiFetch<unknown[]>(`/products?${params.toString()}`);

  if (!Array.isArray(data)) return [];

  return data.map((row) => normalizeProductFromApi(row));
}

export async function fetchProductById(id: number): Promise<Product> {
  const data = await apiFetch<unknown>(`/products/${id}`);

  // 🔥 DEBUG TEMPORAL (puedes quitar luego)
  console.log("📦 RAW PRODUCT FROM API:", data);

  return normalizeProductFromApi(data);
}

export async function createProductRequest(payload: ProductWritePayload): Promise<Product> {
  const data = await apiFetch<unknown>('/products', {
    method: 'POST',
    json: payload,
  });

  return normalizeProductFromApi(data);
}

export async function updateProductRequest(
  id: number,
  payload: Partial<ProductWritePayload>
): Promise<Product> {
  const body: Record<string, unknown> = { ...payload };

  // 🔥 DEBUG CLAVE
  console.log("🚀 UPDATE BODY:", body);

  const data = await apiFetch<unknown>(`/products/${id}`, {
    method: 'PUT',
    json: body,
  });

  console.log("✅ RESPONSE UPDATE:", data);

  return normalizeProductFromApi(data);
}

export async function inactivateProductRequest(id: number): Promise<void> {
  await setProductActiveRequest(id, false);
}

export async function setProductActiveRequest(
  id: number,
  active: boolean
): Promise<void> {
  await apiFetch<undefined>(`/products/${id}`, {
    method: 'PATCH',
    json: { active },
  });
}

export async function deleteProductRequest(id: number): Promise<void> {
  await apiFetch<undefined>(`/products/${id}`, { method: 'DELETE' });
}