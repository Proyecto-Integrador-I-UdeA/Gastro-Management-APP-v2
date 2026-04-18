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
