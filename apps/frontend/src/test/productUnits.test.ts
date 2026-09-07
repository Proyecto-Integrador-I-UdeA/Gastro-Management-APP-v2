import { describe, expect, it } from 'vitest';
import {
  calculateProductIngredientCost,
  productConversionFactor,
  productRegistrationAmountBase,
} from '@/lib/productUnits';

const kilogramProduct = {
  inputUnit: 'kg',
  inputUnitQuantity: 1,
  unitOfMeasure: 'g',
  unitCost: 18_000,
};

describe('conversión de costos de Product en frontend', () => {
  it('calcula 200 g de 1 kg / 18000 como 3600', () => {
    expect(productRegistrationAmountBase(kilogramProduct)).toBe(1000);
    expect(calculateProductIngredientCost(200, kilogramProduct)).toBe(3600);
  });

  it.each([
    ['lb', 'g', 453.59237],
    ['oz', 'g', 28.349523125],
    ['lt', 'ml', 1000],
    ['L', 'ml', 1000],
    ['docena', 'und', 12],
    ['paca', 'und', 24],
  ])('conserva la equivalencia %s -> %s', (inputUnit, baseUnit, expected) => {
    expect(productConversionFactor(inputUnit, baseUnit)).toBe(expected);
  });

  it('rechaza unidades desconocidas o incompatibles', () => {
    expect(() => productConversionFactor('saco', 'g')).toThrow(/desconocida/);
    expect(() => productConversionFactor('kg', 'ml')).toThrow(/compatible/);
  });

  it('mantiene estricta la validación de quantityBase', () => {
    expect(calculateProductIngredientCost(0, kilogramProduct)).toBe(0);
    expect(() => calculateProductIngredientCost(undefined as never, kilogramProduct))
      .toThrow(/quantityBase/);
    expect(() => calculateProductIngredientCost(Number.NaN, kilogramProduct))
      .toThrow(/quantityBase/);
    expect(() => calculateProductIngredientCost(-1, kilogramProduct))
      .toThrow(/quantityBase/);
    expect(() => calculateProductIngredientCost(Number.POSITIVE_INFINITY, kilogramProduct))
      .toThrow(/quantityBase/);
  });
});
