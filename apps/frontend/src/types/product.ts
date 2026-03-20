/**
 * Product JSON shape aligned with Prisma `Product` + optional `supplier` include.
 * `unitCost` may arrive as string from JSON (Prisma Decimal serialization).
 *
 * Not stored in DB (UI-only today): currency selector on forms — add a `currency`
 * column later if you need it in the API.
 *
 * TODO(API): keep this file as the single source of truth for product DTOs;
 * map axios responses here if field names ever differ.
 */
export interface ProductSupplier {
  id: number;
  internalCode: string;
  name: string;
  taxId: string;
  phone: string;
  address: string;
  contactPerson: string;
}

export interface Product {
  id: number;
  internalCode: string;
  name: string;
  category: string;
  isIngredient: boolean;
  isSupply: boolean;
  isFinishedProduct: boolean;
  presentation: string;
  unitOfMeasure: string;
  expirationDate: string | null;
  minStock: number;
  maxStock: number;
  currentStock: number;
  /** Numeric amount; API may send string */
  unitCost: number;
  supplierId: number;
  supplier?: ProductSupplier;
}

export function productLowStock(p: Product): boolean {
  return p.currentStock < p.minStock;
}

export function formatStockDisplay(p: Product): string {
  return `${p.currentStock} ${p.unitOfMeasure}`;
}

export function parseUnitCost(value: unknown): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  return 0;
}
