import { apiFetch } from '@/utils/apiFetch';
import type { Product } from '@/types/product';
import { normalizeProductFromApi } from '@/lib/normalizeProduct';
import type { ProductBaseUnit } from '@/lib/productUnitConversion';

export type ProductWritePayload = {
  internalCode: string;
  name: string;
  category: string;
  isIngredient: boolean;
  isSupply: boolean;
  isFinishedProduct: boolean;
  presentation: string;
  unitOfMeasure: ProductBaseUnit;
  inputUnit: string;
  inputUnitQuantity: number;
  expirationDate: string | null;
  minStock: number;
  maxStock: number;
  currentStock: number;
  unitCost: number;
  supplierId: number;
};

export async function fetchProductsWithSuppliers(): Promise<Product[]> {
  const data = await apiFetch<unknown[]>('/products?include=supplier');
  if (!Array.isArray(data)) return [];
  return data.map((row) => normalizeProductFromApi(row));
}

export async function fetchProductById(id: number): Promise<Product> {
  const data = await apiFetch<unknown>(`/products/${id}`);
  return normalizeProductFromApi(data);
}

export async function createProductRequest(payload: ProductWritePayload): Promise<Product> {
  const data = await apiFetch<unknown>('/products', {
    method: 'POST',
    json: {
      ...payload,
      expirationDate: payload.expirationDate || null,
    },
  });
  return normalizeProductFromApi(data);
}

export async function updateProductRequest(
  id: number,
  payload: Partial<ProductWritePayload>
): Promise<Product> {
  const body: Record<string, unknown> = { ...payload };
  if (payload.expirationDate !== undefined) {
    body.expirationDate = payload.expirationDate || null;
  }
  const data = await apiFetch<unknown>(`/products/${id}`, {
    method: 'PUT',
    json: body,
  });
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
