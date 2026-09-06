import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { SalePriceOutOfRangeError } from '../../src/services/pricing/pricingErrors';
import {
  normalizeMenuItemCostForPricing,
} from '../../src/services/pricing/salePricePrecision';

describe('frontera de precisión Costos -> Pricing', () => {
  it('normaliza snapshots a 4 decimales con ROUND_HALF_UP', () => {
    const result = normalizeMenuItemCostForPricing({
      menuItemId: 1,
      baseCost: new Prisma.Decimal('1.234567'),
      indirectCost: new Prisma.Decimal('0.00006'),
      totalCost: new Prisma.Decimal('1.234627'),
    });

    expect(result.baseCost.toFixed(4)).toBe('1.2346');
    expect(result.indirectCost.toFixed(4)).toBe('0.0001');
    expect(result.totalCost.toFixed(4)).toBe('1.2347');
  });

  it('acepta exactamente el máximo DECIMAL(14,4) en la frontera de pricing', () => {
    const result = normalizeMenuItemCostForPricing({
      menuItemId: 1,
      baseCost: new Prisma.Decimal('9999999999.9999'),
      indirectCost: new Prisma.Decimal(0),
      totalCost: new Prisma.Decimal('9999999999.9999'),
    });

    expect(result.totalCost.toFixed(4)).toBe('9999999999.9999');
  });

  it('rechaza en pricing un costo que el motor general sí puede calcular', () => {
    expect(() => normalizeMenuItemCostForPricing({
      menuItemId: 1,
      baseCost: new Prisma.Decimal('10000000000.25'),
      indirectCost: new Prisma.Decimal(0),
      totalCost: new Prisma.Decimal('10000000000.25'),
    })).toThrow(SalePriceOutOfRangeError);
  });
});
