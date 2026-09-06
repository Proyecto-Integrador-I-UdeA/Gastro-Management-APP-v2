import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { salePriceInputSchema } from '../../src/schemas/salePriceSchema';
import { calculateSalePrice } from '../../src/services/pricing/salePriceCalculator';
import {
  InvalidSalePriceInputError,
  SalePriceOutOfRangeError,
} from '../../src/services/pricing/pricingErrors';

describe('motor Decimal de precio de venta', () => {
  it.each([
    {
      description: 'marginRate con seis decimales',
      input: { marginRate: '0.123456', taxRate: '0' },
      totalCost: '10000',
    },
    {
      description: 'taxRate con seis decimales',
      input: { marginRate: '0', taxRate: '0.123456' },
      totalCost: '10000',
    },
    {
      description: 'marginRate máximo representable menor que uno',
      input: { marginRate: '0.999999', taxRate: '0' },
      totalCost: '1',
    },
    {
      description: 'taxRate igual a uno',
      input: { marginRate: '0', taxRate: '1' },
      totalCost: '10000',
    },
  ])('acepta $description', ({ input, totalCost }) => {
    expect(salePriceInputSchema.safeParse(input).success).toBe(true);
    expect(() => calculateSalePrice({ totalCost, ...input })).not.toThrow();
  });

  it.each([
    {
      description: 'marginRate con siete decimales',
      input: { marginRate: '0.1234567', taxRate: '0' },
    },
    {
      description: 'taxRate con siete decimales',
      input: { marginRate: '0', taxRate: '0.1234567' },
    },
    {
      description: 'marginRate que se redondearía a uno en PostgreSQL',
      input: { marginRate: '0.9999999', taxRate: '0' },
    },
  ])('rechaza $description en el schema de entrada', ({ input }) => {
    expect(salePriceInputSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    { marginRate: '0.1234567', taxRate: '0' },
    { marginRate: '0', taxRate: '0.1234567' },
    { marginRate: '0.9999999', taxRate: '0' },
  ])(
    'rechaza tasas no representables aunque se omita el schema: %o',
    rates => {
      expect(() =>
        calculateSalePrice({ totalCost: '10000', ...rates }),
      ).toThrow('no puede tener más de 6 posiciones decimales');
    },
  );

  it('calcula margen 0 e impuesto 0', () => {
    const result = calculateSalePrice({
      totalCost: '10000',
      marginRate: '0',
      taxRate: '0',
    });

    expect(result.priceBeforeTax.toString()).toBe('10000');
    expect(result.taxAmount.toString()).toBe('0');
    expect(result.amount.toString()).toBe('10000');
  });

  it('aplica margen sobre venta 0.40 e impuesto 0.19', () => {
    const result = calculateSalePrice({
      totalCost: '17000',
      marginRate: '0.40',
      taxRate: '0.19',
    });

    expect(result.priceBeforeTax.toFixed(4)).toBe('28333.3333');
    expect(result.taxAmount.toFixed(4)).toBe('5383.3333');
    expect(result.calculatedAmount.toFixed(4)).toBe('33716.6666');
    expect(result.amount.toString()).toBe('34000');
  });

  it('no incrementa un valor que ya es múltiplo exacto de 1000', () => {
    expect(calculateSalePrice({
      totalCost: '20000',
      marginRate: '0',
      taxRate: '0',
    }).amount.toString()).toBe('20000');
  });

  it.each([
    { marginRate: '-0.01', taxRate: '0', expected: 'marginRate' },
    { marginRate: '1', taxRate: '0', expected: 'marginRate' },
    { marginRate: '1.1', taxRate: '0', expected: 'marginRate' },
    { marginRate: '0', taxRate: '-0.01', expected: 'taxRate' },
    { marginRate: '0', taxRate: '1.01', expected: 'taxRate' },
  ])('rechaza tasas fuera de rango: $expected', ({ marginRate, taxRate }) => {
    expect(() => calculateSalePrice({
      totalCost: '10000',
      marginRate,
      taxRate,
    })).toThrow(InvalidSalePriceInputError);
  });

  it('normaliza determinísticamente los valores monetarios con ROUND_HALF_UP', () => {
    const result = calculateSalePrice({
      totalCost: new Prisma.Decimal('123.45675'),
      marginRate: '0',
      taxRate: '0',
      roundingIncrement: '0.01',
    });

    expect(result.priceBeforeTax.toFixed(4)).toBe('123.4568');
    expect(result.taxAmount.toFixed(4)).toBe('0.0000');
    expect(result.calculatedAmount.toFixed(4)).toBe('123.4568');
    expect(result.amount.toFixed(2)).toBe('123.46');
  });

  it('usa el costo normalizado al decidir un CEIL cercano al múltiplo de 1000', () => {
    const result = calculateSalePrice({
      totalCost: '1000.00004',
      marginRate: '0',
      taxRate: '0',
    });

    expect(result.calculatedAmount.toFixed(4)).toBe('1000.0000');
    expect(result.amount.toFixed(2)).toBe('1000.00');
  });

  it('acepta exactamente el máximo representable por DECIMAL(12,2)', () => {
    const result = calculateSalePrice({
      totalCost: '9999999999.99',
      marginRate: '0',
      taxRate: '0',
      roundingIncrement: '0.01',
    });

    expect(result.amount.toFixed(2)).toBe('9999999999.99');
  });

  it('rechaza priceBeforeTax que excede DECIMAL(14,4)', () => {
    expect(() => calculateSalePrice({
      totalCost: '10000',
      marginRate: '0.999999',
      taxRate: '0',
    })).toThrow(SalePriceOutOfRangeError);
  });

  it('rechaza amount que excede DECIMAL(12,2)', () => {
    expect(() => calculateSalePrice({
      totalCost: '9999999500',
      marginRate: '0',
      taxRate: '0',
    })).toThrow(SalePriceOutOfRangeError);
  });

  it('mantiene marginRate 0.999999 cuando el resultado completo cabe', () => {
    const result = calculateSalePrice({
      totalCost: '1',
      marginRate: '0.999999',
      taxRate: '0',
    });

    expect(result.priceBeforeTax.toFixed(4)).toBe('1000000.0000');
    expect(result.amount.toFixed(2)).toBe('1000000.00');
  });
});
