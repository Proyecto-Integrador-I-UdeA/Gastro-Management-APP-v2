/**
 * Product JSON aligned with Prisma `Product` + optional `supplier` include.
 */
import type { Supplier } from './supplier';

/** Same entity as `Supplier` when embedded on a product */
export type ProductSupplier = Supplier;

export interface Product {
  id: number;
  internalCode?: string;
  name: string;
  category: string;
  isIngredient: boolean;
  isSupply: boolean;
  isFinishedProduct: boolean;
  presentation: string;
  unitCost: number; 
  /** Unidad base en Kardex: g, ml o und */
  unitOfMeasure: string;
  inputUnit: string;
  inputUnitQuantity: number;
  expirationDate: string | null;
  minStock: number;
  maxStock: number;
  currentStock: number;
  supplierId: number;
  /** Catálogo Kardex: producto activo en sistema */
  active?: boolean;
  supplier?: ProductSupplier;
}

/** Etiquetas según los flags del producto (puede haber varias). */
export function productTypeLabels(p: Product): string[] {
  const labels: string[] = [];
  if (p.isIngredient) labels.push('Ingrediente');
  if (p.isSupply) labels.push('Insumo');
  if (p.isFinishedProduct) labels.push('Producto terminado');
  return labels;
}

export function productLowStock(p: Product): boolean {
  return (p.currentStock ?? 0) < p.minStock;
}

export function formatStockDisplay(p: Product): string {
  return `${p.currentStock ?? 0} ${p.unitOfMeasure}`;
}
