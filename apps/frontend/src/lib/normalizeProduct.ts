import type { Product } from '@/types/product';
import { normalizeSupplierFromApi } from '@/lib/normalizeSupplier';
import { isProductInputUnit } from '@/lib/productUnits';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

export function normalizeProductFromApi(raw: unknown): Product {
  const r = asRecord(raw);
  if (!r) {
    throw new Error('Invalid product payload');
  }
  const exp = r.expirationDate;
  let expirationDate: string | null = null;
  if (exp != null && exp !== '') {
    expirationDate = new Date(String(exp)).toISOString();
  }

  const rawInputUnit = r.inputUnit;
  const inputUnit = isProductInputUnit(rawInputUnit) ? rawInputUnit : 'g';
  const inputUnitQuantity = Number(r.inputUnitQuantity ?? 1);

  return {
    id: Number(r.id),
    internalCode: String(r.internalCode ?? ''),
    name: String(r.name ?? ''),
    category: String(r.category ?? ''),
    isIngredient: Boolean(r.isIngredient),
    isSupply: Boolean(r.isSupply),
    isFinishedProduct: Boolean(r.isFinishedProduct),
    presentation: String(r.presentation ?? ''),
    unitOfMeasure: String(r.unitOfMeasure ?? ''),
    inputUnit,
    inputUnitQuantity: Number.isFinite(inputUnitQuantity) && inputUnitQuantity > 0 ? inputUnitQuantity : 1,
    expirationDate,
    minStock: Number(r.minStock ?? 0),
    maxStock: Number(r.maxStock ?? 0),
    currentStock: Number(r.currentStock ?? 0),
    supplierId: Number(r.supplierId ?? 0),
    active: r.active === undefined ? true : Boolean(r.active),
    supplier: normalizeSupplierFromApi(r.supplier),
  };
}
