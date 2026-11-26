import { apiFetch } from '@/utils/apiFetch';
import type {
  CostsReportResponse,
  ProductsInventoryRiskResponse,
  ProductionReportResponse,
  SuppliersCatalogResponse,
  TransfersReportResponse,
} from '@/types/reports';
import { api } from '@/utils/api';

// ── Funciones existentes (sin cambios) ──────────────────────────────
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

export async function fetchProductionReport(): Promise<ProductionReportResponse> {
  return apiFetch<ProductionReportResponse>('/reports/production/summary');
}

export async function fetchCostsReport(): Promise<CostsReportResponse> {
  return apiFetch<CostsReportResponse>('/reports/costs/summary');
}

// ── Tipos para PDF Producción y Costos ──────────────────────────────
interface MovementSummary {
  count: number;
  totalValue: number;
  totalQuantity: number;
}

export interface ProductionSummary {
  dispatchCount: number;
  theoreticalCost: number;
  wasteCost: number;
  totalCost: number;
  averageCostPerDispatch: number;
  consumptionItemCount: number;
}

export interface ProductionCostsReportResponse {
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  summary: ProductionSummary;
  previousSummary: ProductionSummary;
  movementsByType: {
    PURCHASE: MovementSummary;
    CONSUMPTION: MovementSummary;
    WASTE: MovementSummary;
    TRANSFER: MovementSummary;
    ADJUSTMENT: MovementSummary;
  };
  products: Array<{ name: string; unit: string; quantity: number; cost: number }>;
  recipes: Array<{ name: string; quantity: number; cost: number }>;
  warehouses: Array<{ name: string; cost: number; dispatches: number }>;
  wasteByProduct: Array<{ name: string; unit: string; quantity: number; cost: number }>;
  menuStructure: {
    totalActiveItems: number;
    averageCost: number;
    averagePrice: number;
    averageMargin: number;
    topByCost: Array<{ name: string; cost: number; price: number; margin: number }>;
  };
  payrollSummary: {
    entriesCount: number;
    totalSalary: number;
    totalExtras: number;
    totalBenefits: number;
    totalDeductions: number;
    grossTotal: number;
  };
  operatingExpenses: {
    fixed: number;
    variable: number;
    total: number;
    items: Array<{ concept: string; kind: string; amount: number }>;
  };
  criticalStock: Array<{
    name: string;
    unit: string;
    currentStock: number;
    minStock: number;
    missing: number;
    unitCost: number;
    refillValue: number;
  }>;
  expiringSoon: Array<{
    product: string;
    unit: string;
    quantity: number;
    expirationDate: string;
    unitCost: number;
    value: number;
  }>;
  postedCounts: {
    total: number;
    items: Array<{
      id: number;
      warehouse: string;
      postedAt: string;
      itemCount: number;
      totalVarianceQty: number;
      totalVarianceValue: number;
    }>;
  };
  financialMovements: FinancialMovementsSummary;
}

// ── Tipos para PDF Ventas ───────────────────────────────────────────
export interface SalesSummary {
  orderCount: number;
  openCount: number;
  voidedCount: number;
  totalSales: number;
  totalTax: number;
  totalService: number;
  totalItems: number;
  avgTicket: number;
  avgItemsPerOrder: number;
}

export interface SalesReportResponse {
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  summary: SalesSummary;
  previousSummary: SalesSummary;
  items: Array<{ name: string; category: string; quantity: number; revenue: number }>;
  categories: Array<{ name: string; quantity: number; revenue: number }>;
  paymentMethods: Array<{ method: string; count: number; amount: number }>;
  salesByDay: Array<{ date: string; orders: number; revenue: number }>;
  topTables: Array<{ code: string; area: string; orders: number; revenue: number }>;
  kitchenSLA: {
    totalDispatches: number;
    avgPrepMinutes: number;
    onTimeCount: number;
    onTimePercent: number;
    delayedCount: number;
    
  };
  reservations: {
    total: number;
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    completionRate: number;
    byType: Array<{ type: string; count: number }>;
  };
  addons: Array<{ name: string; quantity: number; revenue: number }>;
  voidedOrders: Array<{
    id: number;
    tableCode: string;
    voidedAt: string;
    reason: string;
    estimatedAmount: number;
  }>;
  cashSessionsSummary: {
    totalClosed: number;
    totalWithDifference: number;
    totalDifference: number;
    recent: Array<{
      id: number;
      register: string;
      closedAt: string;
      openingCash: number;
      expectedCash: number;
      countedCash: number;
      difference: number;
    }>;
  };
  analytics: SalesAnalyticsData;
  profitabilityByProduct: ProfitabilityByProduct;
}



export async function fetchProductionCostsReport(
  from: string,
  to: string,
): Promise<ProductionCostsReportResponse> {
  const q = new URLSearchParams({ from, to }).toString();
  return apiFetch<ProductionCostsReportResponse>(
    `/reports/production-costs?${q}`,
  );
}

export async function fetchSalesReport(
  from: string,
  to: string,
): Promise<SalesReportResponse> {
  const q = new URLSearchParams({ from, to }).toString();
  return apiFetch<SalesReportResponse>(`/reports/sales?${q}`);
}

// ── Nuevos tipos para /sales/analytics ─────────────────────────────
export interface AnalyticsSummary {
  salesAmount: number;
  consumptionTaxAmount: number;
  serviceAmount: number;
  totalCollected: number;
  closedOrders: number;
  unitsSold: number;
}

export interface AnalyticsItem {
  menuItemId: number;
  name: string;
  quantity: number;
  salesAmount: number;
  consumptionTaxAmount: number;
  grossAmount: number;
  consumptionSubtotal: number;
}

export interface AnalyticsCategory {
  categoryId: number | null;
  categoryName: string;
  quantity: number;
  salesAmount: number;
  consumptionTaxAmount: number;
  grossAmount: number;
  consumptionSubtotal: number;
}

export interface AnalyticsOrderDetail {
  settledAt: string;
  orderId: number;
  table: string;
  items: Array<{ name: string; quantity: number; isAddition: boolean }>;
  salesAmount: number;
  consumptionTaxAmount: number;
  serviceAmount: number;
  totalCollected: number;
  currency: string;
}

export interface SalesAnalyticsData {
  period: { from: string; to: string };
  ytd: { from: string; to: string };
  summary: AnalyticsSummary;
  ytdSummary: AnalyticsSummary;
  products: AnalyticsItem[];
  categories: AnalyticsCategory[];
  orderDetails: AnalyticsOrderDetail[];
}

// ── Nuevos tipos para /finance/profitability/by-product ────────────
export interface ProfitabilityItem {
  name: string;
  category: string;
  quantity: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
  contributionPct: number;
}

export interface ProfitabilityByProduct {
  totalRevenue: number;
  totalCost: number;
  totalMargin: number;
  marginPct: number;
  items: ProfitabilityItem[];
}

// ── Nuevos tipos para /finance/movements ───────────────────────────
export interface FinancialMovementRow {
  id: number;
  kind: 'INCOME' | 'EXPENSE';
  occurredAt: string;
  concept: string;
  amount: number;
  documentNumber: string | null;
  counterpartyName: string | null;
  paymentMethodName: string;
}

export interface PaymentMethodBalance {
  id: number;
  name: string;
  kind: string;
  currentBalance: number;
  income: number;
  expense: number;
  net: number;
}

export interface FinancialMovementsSummary {
  totalIncome: number;
  totalExpense: number;
  net: number;
  count: number;
  byPaymentMethod: PaymentMethodBalance[];
  recent: FinancialMovementRow[];
}