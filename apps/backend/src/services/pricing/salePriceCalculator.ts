import { Prisma } from '@prisma/client';
import { InvalidSalePriceInputError } from './pricingErrors';
import {
  normalizeSalePriceAmount,
  normalizeSalePriceSnapshot,
} from './salePricePrecision';

export const SALE_PRICE_ROUNDING_INCREMENT = new Prisma.Decimal('1000.00');
export const SALE_PRICE_CURRENCY = 'COP';
export const SALE_PRICE_CALCULATION_VERSION = 'sales-price-v1';
export const SALE_PRICE_RATE_DECIMAL_PLACES = 6;

export type SalePriceCalculationInput = {
  totalCost: Prisma.Decimal.Value;
  marginRate: Prisma.Decimal.Value;
  taxRate: Prisma.Decimal.Value;
  roundingIncrement?: Prisma.Decimal.Value;
};

export type SalePriceCalculation = {
  marginRate: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  priceBeforeTax: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  calculatedAmount: Prisma.Decimal;
  roundingIncrement: Prisma.Decimal;
  amount: Prisma.Decimal;
  currency: typeof SALE_PRICE_CURRENCY;
  taxIncluded: true;
  calculationVersion: typeof SALE_PRICE_CALCULATION_VERSION;
};

function decimal(value: Prisma.Decimal.Value, field: string): Prisma.Decimal {
  try {
    const parsed = new Prisma.Decimal(value);
    if (!parsed.isFinite()) throw new Error();
    return parsed;
  } catch {
    throw new InvalidSalePriceInputError(`${field} debe ser un decimal válido`);
  }
}

function rateDecimal(
  value: Prisma.Decimal.Value,
  field: 'marginRate' | 'taxRate',
): Prisma.Decimal {
  const parsed = decimal(value, field);
  const stringDecimalPlaces =
    typeof value === 'string' && value.includes('.')
      ? value.length - value.indexOf('.') - 1
      : 0;

  if (
    stringDecimalPlaces > SALE_PRICE_RATE_DECIMAL_PLACES ||
    parsed.decimalPlaces() > SALE_PRICE_RATE_DECIMAL_PLACES
  ) {
    throw new InvalidSalePriceInputError(
      `${field} no puede tener más de ${SALE_PRICE_RATE_DECIMAL_PLACES} posiciones decimales`,
    );
  }

  return parsed;
}

export function calculateSalePrice(
  input: SalePriceCalculationInput,
): SalePriceCalculation {
  const totalCost = normalizeSalePriceSnapshot(
    decimal(input.totalCost, 'totalCost'),
    'totalCostSnapshot',
  );
  const marginRate = rateDecimal(input.marginRate, 'marginRate');
  const taxRate = rateDecimal(input.taxRate, 'taxRate');
  const roundingIncrement = normalizeSalePriceAmount(
    decimal(
      input.roundingIncrement ?? SALE_PRICE_ROUNDING_INCREMENT,
      'roundingIncrement',
    ),
    'roundingIncrement',
  );

  if (totalCost.lte(0)) {
    throw new InvalidSalePriceInputError('El costo total debe ser mayor que 0');
  }
  if (marginRate.lt(0) || marginRate.gte(1)) {
    throw new InvalidSalePriceInputError('marginRate debe ser mayor o igual a 0 y menor que 1');
  }
  if (taxRate.lt(0) || taxRate.gt(1)) {
    throw new InvalidSalePriceInputError('taxRate debe estar entre 0 y 1');
  }
  if (roundingIncrement.lte(0)) {
    throw new InvalidSalePriceInputError('roundingIncrement debe ser mayor que 0');
  }

  const priceBeforeTax = normalizeSalePriceSnapshot(
    totalCost.div(new Prisma.Decimal(1).minus(marginRate)),
    'priceBeforeTax',
  );
  const taxAmount = normalizeSalePriceSnapshot(
    priceBeforeTax.mul(taxRate),
    'taxAmount',
  );
  const calculatedAmount = normalizeSalePriceSnapshot(
    priceBeforeTax.plus(taxAmount),
    'calculatedAmount',
  );
  const amount = normalizeSalePriceAmount(
    calculatedAmount.div(roundingIncrement).ceil().mul(roundingIncrement),
    'amount',
  );

  return {
    marginRate,
    taxRate,
    priceBeforeTax,
    taxAmount,
    calculatedAmount,
    roundingIncrement,
    amount,
    currency: SALE_PRICE_CURRENCY,
    taxIncluded: true,
    calculationVersion: SALE_PRICE_CALCULATION_VERSION,
  };
}
