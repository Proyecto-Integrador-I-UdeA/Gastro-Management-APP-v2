import { apiFetch } from '@/utils/apiFetch';
import type {
  ProductsInventoryRiskResponse,
  SuppliersCatalogResponse,
  TransfersReportResponse,
} from '@/types/reports';

export async function fetchProductsInventoryRisk(): Promise<ProductsInventoryRiskResponse> {
  return apiFetch<ProductsInventoryRiskResponse>('/reports/products/inventory-risk');
}

export async function fetchSuppliersCatalogReport(): Promise<SuppliersCatalogResponse> {
  return apiFetch<SuppliersCatalogResponse>('/reports/suppliers/catalog');
}

export async function fetchTransfersReportSummary(params: {
  from: string;
  to: string;
}): Promise<TransfersReportResponse> {
  const q = new URLSearchParams(params).toString();
  return apiFetch<TransfersReportResponse>(`/reports/transfers/summary?${q}`);
}
