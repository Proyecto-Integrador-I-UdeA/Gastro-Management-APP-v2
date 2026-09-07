import { Prisma } from '@prisma/client';
import { InvalidCostComponentError } from './pricingErrors';

type DecimalValue = Prisma.Decimal.Value;

export type ProductCostInput = {
  inputUnit: string;
  unitOfMeasure: string;
  inputUnitQuantity: DecimalValue;
  unitCost: DecimalValue;
};

type SupportedBaseUnit = 'g' | 'ml' | 'und';

const UNIT_CONVERSIONS: Record<
  string,
  { baseUnit: SupportedBaseUnit; factor: string }
> = {
  g: { baseUnit: 'g', factor: '1' },
  kg: { baseUnit: 'g', factor: '1000' },
  lb: { baseUnit: 'g', factor: '453.59237' },
  oz: { baseUnit: 'g', factor: '28.349523125' },
  ml: { baseUnit: 'ml', factor: '1' },
  lt: { baseUnit: 'ml', factor: '1000' },
  gal: { baseUnit: 'ml', factor: '3785.411784' },
  und: { baseUnit: 'und', factor: '1' },
  docena: { baseUnit: 'und', factor: '12' },
  paca: { baseUnit: 'und', factor: '24' },
};

function decimal(value: DecimalValue, field: string): Prisma.Decimal {
  try {
    const parsed = new Prisma.Decimal(value);
    if (!parsed.isFinite()) throw new Error();
    return parsed;
  } catch {
    throw new InvalidCostComponentError(`${field} no es un decimal válido`);
  }
}

function normalizedInputUnit(inputUnit: string): string {
  const normalized = String(inputUnit ?? '').trim().toLowerCase();
  return normalized === 'l' ? 'lt' : normalized;
}

function normalizedBaseUnit(unitOfMeasure: string): string {
  return String(unitOfMeasure ?? '').trim().toLowerCase();
}

export function conversionFactor(
  inputUnit: string,
  unitOfMeasure: string,
): Prisma.Decimal {
  const normalizedInput = normalizedInputUnit(inputUnit);
  const normalizedBase = normalizedBaseUnit(unitOfMeasure);
  const conversion = UNIT_CONVERSIONS[normalizedInput];

  if (!conversion) {
    throw new InvalidCostComponentError(
      `inputUnit desconocida: ${inputUnit}`,
    );
  }

  if (conversion.baseUnit !== normalizedBase) {
    throw new InvalidCostComponentError(
      `inputUnit ${inputUnit} no es compatible con unitOfMeasure ${unitOfMeasure}`,
    );
  }

  return new Prisma.Decimal(conversion.factor);
}

export function registrationAmountBase(
  product: Pick<ProductCostInput, 'inputUnit' | 'unitOfMeasure' | 'inputUnitQuantity'>,
): Prisma.Decimal {
  const inputUnitQuantity = decimal(
    product.inputUnitQuantity,
    'product.inputUnitQuantity',
  );
  if (inputUnitQuantity.lte(0)) {
    throw new InvalidCostComponentError(
      'product.inputUnitQuantity debe ser mayor que 0',
    );
  }

  return inputUnitQuantity.mul(
    conversionFactor(product.inputUnit, product.unitOfMeasure),
  );
}

export function costPerBaseUnit(product: ProductCostInput): Prisma.Decimal {
  const unitCost = decimal(product.unitCost, 'product.unitCost');
  if (unitCost.lt(0)) {
    throw new InvalidCostComponentError('product.unitCost no puede ser negativo');
  }

  return unitCost.div(registrationAmountBase(product));
}

export function ingredientCost(
  quantityBaseValue: DecimalValue,
  product: ProductCostInput,
): Prisma.Decimal {
  const quantityBase = decimal(quantityBaseValue, 'quantityBase');
  if (quantityBase.lt(0)) {
    throw new InvalidCostComponentError('quantityBase no puede ser negativa');
  }

  return quantityBase.mul(costPerBaseUnit(product));
}
