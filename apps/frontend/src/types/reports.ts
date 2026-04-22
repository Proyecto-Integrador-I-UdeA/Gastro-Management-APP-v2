export type InventoryRiskLevel = 'zero' | 'low' | 'high' | 'ok';

export interface ProductInventoryRiskRow {
  productId: number;
  internalCode: string;
  name: string;
  unitOfMeasure: string;
  supplierName: string;
  minStock: number;
  maxStock: number;
  totalQuantity: number;
  risk: InventoryRiskLevel;
  deficitBelowMin: number | null;
  excessAboveMax: number | null;
}

export interface ProductsInventoryRiskKpis {
  totalActiveProducts: number;
  zeroStock: number;
  lowStock: number;
  highStock: number;
  okStock: number;
}

export interface ProductsInventoryRiskResponse {
  kpis: ProductsInventoryRiskKpis;
  rows: ProductInventoryRiskRow[];
  rankings: {
    criticalLow: ProductInventoryRiskRow[];
    highExcess: ProductInventoryRiskRow[];
    topByTotalStock: ProductInventoryRiskRow[];
  };
}

export interface SupplierCatalogRow {
  supplierId: number;
  internalCode: string;
  name: string;
  taxId: string;
  active: boolean;
  activeProductCount: number;
  totalProductCount: number;
}

export interface SuppliersCatalogKpis {
  totalSuppliers: number;
  activeSuppliers: number;
  inactiveSuppliers: number;
  activeWithNoActiveProducts: number;
}

export interface SuppliersCatalogResponse {
  kpis: SuppliersCatalogKpis;
  rows: SupplierCatalogRow[];
  rankings: {
    topByActiveProducts: SupplierCatalogRow[];
    noActiveProducts: SupplierCatalogRow[];
  };
}

export interface TransfersReportKpis {
  movementCount: number;
  totalQuantity: number;
  distinctProducts: number;
  distinctWarehouses: number;
}

export interface TransfersReportTimePoint {
  day: string;
  movementCount: number;
  totalQuantity: number;
}

export interface TransfersReportProductRank {
  productId: number;
  internalCode: string;
  name: string;
  unitOfMeasure: string;
  totalQuantity: number;
}

export interface TransfersReportRouteRow {
  sourceWarehouseId: number | null;
  sourceWarehouseName: string;
  destinationWarehouseId: number | null;
  destinationWarehouseName: string;
  movementCount: number;
  totalQuantity: number;
}

export interface TransfersReportDetailRow {
  id: number;
  quantity: number;
  createdAt: string;
  notes: string | null;
  product: {
    id: number;
    internalCode: string;
    name: string;
    unitOfMeasure: string;
  };
  sourceWarehouse: { id: number; name: string } | null;
  destinationWarehouse: { id: number; name: string } | null;
  user: { id: number; fullName: string | null; email: string };
}

export interface TransfersReportResponse {
  range: { from: string; to: string };
  kpis: TransfersReportKpis;
  timeSeries: TransfersReportTimePoint[];
  topProducts: TransfersReportProductRank[];
  routes: TransfersReportRouteRow[];
  details: TransfersReportDetailRow[];
}
