import { describe, expect, it } from 'vitest';
import {
  conversionFactor,
  costPerBaseUnit,
  ingredientCost,
  registrationAmountBase,
} from '../../src/services/pricing/productUnitCost';
import { InvalidCostComponentError } from '../../src/services/pricing/pricingErrors';

const product = (overrides: Partial<{
  inputUnit: string;
  unitOfMeasure: string;
  inputUnitQuantity: string | number;
  unitCost: string | number;
}> = {}) => ({
  inputUnit: 'kg',
  unitOfMeasure: 'g',
  inputUnitQuantity: 1,
  unitCost: 18_000,
  ...overrides,
});

describe('costo canónico de Product por unidad base', () => {
  it('calcula 200 g de una presentación de 1 kg / 18000 como 3600', () => {
    const value = product();

    expect(registrationAmountBase(value).toString()).toBe('1000');
    expect(costPerBaseUnit(value).toString()).toBe('18');
    expect(ingredientCost(200, value).toString()).toBe('3600');
  });

  it('calcula 200 g de una presentación de 1000 g / 18000 como 3600', () => {
    expect(ingredientCost(200, product({ inputUnit: 'g', inputUnitQuantity: 1000 })).toString())
      .toBe('3600');
  });

  it.each([
    ['kg', 'g', 5, '5000'],
    ['lt', 'ml', 1, '1000'],
    ['L', 'ml', 1, '1000'],
    ['docena', 'und', 1, '12'],
    ['paca', 'und', 1, '24'],
    ['lb', 'g', 1, '453.59237'],
    ['oz', 'g', 1, '28.349523125'],
  ])(
    'convierte %s a %s con la equivalencia existente',
    (inputUnit, unitOfMeasure, inputUnitQuantity, expected) => {
      expect(registrationAmountBase(product({
        inputUnit,
        unitOfMeasure,
        inputUnitQuantity,
      })).toString()).toBe(expected);
    },
  );

  it('rechaza unidades incompatibles', () => {
    expect(() => conversionFactor('kg', 'ml'))
      .toThrow(InvalidCostComponentError);
  });

  it.each([0, -1, 'invalid', Number.NaN, Number.POSITIVE_INFINITY])(
    'rechaza inputUnitQuantity inválida: %s',
    inputUnitQuantity => {
      expect(() => registrationAmountBase(product({ inputUnitQuantity })))
        .toThrow(InvalidCostComponentError);
    },
  );

  it('rechaza una inputUnit desconocida', () => {
    expect(() => conversionFactor('saco', 'g'))
      .toThrow(InvalidCostComponentError);
  });
});
