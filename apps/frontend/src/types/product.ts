/**
 * Product JSON aligned with Prisma `Product` + optional `supplier` include.
 * `unitCost` may arrive as string from JSON (Prisma Decimal).
 */
import type { Supplier } from './supplier';

/** Same entity as `Supplier` when embedded on a product */
export type ProductSupplier = Supplier;

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
  unitCost: number;
  supplierId: number;
  /** Catálogo Kardex: producto activo en sistema */
  active?: boolean;
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
