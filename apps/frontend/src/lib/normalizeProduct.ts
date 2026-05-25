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

  // 🔥 FIX CLAVE
  const unitCost =
    r.unitCost !== undefined && r.unitCost !== null
      ? Number(r.unitCost)
      : 0;



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

  inputUnitQuantity:
    Number.isFinite(inputUnitQuantity) && inputUnitQuantity > 0
      ? inputUnitQuantity
      : 1,

  expirationDate,

  minStock: Number(r.minStock ?? 0),
  maxStock: Number(r.maxStock ?? 0),
  currentStock: Number(r.currentStock ?? 0),

  supplierId: Number(r.supplierId ?? 0),

  active: r.active === undefined ? true : Boolean(r.active),
  isSeedProduct: Boolean(r.isSeedProduct),
  unitCost,

  catalogId:
    r.catalogId !== undefined && r.catalogId !== null
      ? Number(r.catalogId)
      : null,

  caloriesPer100g:
    r.caloriesPer100g !== undefined && r.caloriesPer100g !== null
      ? Number(r.caloriesPer100g)
      : null,

  carbsPer100g:
    r.carbsPer100g !== undefined && r.carbsPer100g !== null
      ? Number(r.carbsPer100g)
      : null,

  fatPer100g:
    r.fatPer100g !== undefined && r.fatPer100g !== null
      ? Number(r.fatPer100g)
      : null,

  proteinPer100g:
    r.proteinPer100g !== undefined && r.proteinPer100g !== null
      ? Number(r.proteinPer100g)
      : null,

  sugarPer100g:
    r.sugarPer100g !== undefined && r.sugarPer100g !== null
      ? Number(r.sugarPer100g)
      : null,
  sodiumPer100g:
  r.sodiumPer100g !== undefined && r.sodiumPer100g !== null
    ? Number(r.sodiumPer100g)
    : null,

supplier: r.supplier
  ? normalizeSupplierFromApi(r.supplier)
  : undefined,
};
}