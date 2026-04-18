import { apiFetch } from '@/utils/apiFetch';
import type {
  ProductsInventoryRiskResponse,
  SuppliersCatalogResponse,
} from '@/types/reports';

export async function fetchProductsInventoryRisk(): Promise<ProductsInventoryRiskResponse> {
  return apiFetch<ProductsInventoryRiskResponse>('/reports/products/inventory-risk');
}

export async function fetchSuppliersCatalogReport(): Promise<SuppliersCatalogResponse> {
  return apiFetch<SuppliersCatalogResponse>('/reports/suppliers/catalog');
}
