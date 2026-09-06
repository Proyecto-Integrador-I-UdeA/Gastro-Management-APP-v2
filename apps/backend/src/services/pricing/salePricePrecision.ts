import { Prisma } from '@prisma/client';
import type { MenuItemCostResult } from './menuItemCostService';
import { SalePriceOutOfRangeError } from './pricingErrors';

export const SALE_PRICE_SNAPSHOT_DECIMAL_PLACES = 4;
export const SALE_PRICE_AMOUNT_DECIMAL_PLACES = 2;
export const SALE_PRICE_DECIMAL_14_4_MAX = new Prisma.Decimal('9999999999.9999');
export const SALE_PRICE_DECIMAL_12_2_MAX = new Prisma.Decimal('9999999999.99');
export const SALE_PRICE_MONETARY_ROUNDING_MODE = Prisma.Decimal.ROUND_HALF_UP;

function normalizeAndValidateRange(
  value: Prisma.Decimal,
  decimalPlaces: number,
  maximum: Prisma.Decimal,
  field: string,
): Prisma.Decimal {
  const normalized = value.toDecimalPlaces(
    decimalPlaces,
    SALE_PRICE_MONETARY_ROUNDING_MODE,
  );

  if (!normalized.isFinite() || normalized.abs().gt(maximum)) {
    throw new SalePriceOutOfRangeError(field, maximum.toFixed(decimalPlaces));
  }

  return normalized;
}

/** Normaliza valores persistibles como DECIMAL(14,4) usando ROUND_HALF_UP. */
export function normalizeSalePriceSnapshot(
  value: Prisma.Decimal,
  field: string,
): Prisma.Decimal {
  return normalizeAndValidateRange(
    value,
    SALE_PRICE_SNAPSHOT_DECIMAL_PLACES,
    SALE_PRICE_DECIMAL_14_4_MAX,
    field,
  );
}

/** Normaliza valores persistibles como DECIMAL(12,2) usando ROUND_HALF_UP. */
export function normalizeSalePriceAmount(
  value: Prisma.Decimal,
  field: string,
): Prisma.Decimal {
  return normalizeAndValidateRange(
    value,
    SALE_PRICE_AMOUNT_DECIMAL_PLACES,
    SALE_PRICE_DECIMAL_12_2_MAX,
    field,
  );
}

/** Crea los snapshots de costos propios de MenuItemPrice sin alterar el motor general. */
export function normalizeMenuItemCostForPricing(
  cost: MenuItemCostResult,
): MenuItemCostResult {
  const baseCost = normalizeSalePriceSnapshot(
    cost.baseCost,
    'baseCostSnapshot',
  );
  const indirectCost = normalizeSalePriceSnapshot(
    cost.indirectCost,
    'indirectCostSnapshot',
  );
  const totalCost = normalizeSalePriceSnapshot(
    baseCost.plus(indirectCost),
    'totalCostSnapshot',
  );

  return {
    menuItemId: cost.menuItemId,
    baseCost,
    indirectCost,
    totalCost,
  };
}
