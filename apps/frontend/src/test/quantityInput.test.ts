import { describe, expect, it } from 'vitest';
import {
  allQuantitiesValid,
  classifyQuantity,
  quantityError,
  quantityInputValue,
} from '@/lib/quantityInput';

describe('clasificación de cantidades de formularios', () => {
  it.each([1, 1.5])('acepta cantidades finitas mayores que cero: %s', value => {
    expect(classifyQuantity(value)).toEqual({ status: 'valid', value });
  });

  it('rechaza cero con un mensaje de negocio claro', () => {
    expect(classifyQuantity(0)).toEqual({
      status: 'invalid',
      message: 'La cantidad debe ser mayor que 0.',
    });
  });

  it.each(['', undefined, null])('distingue una cantidad incompleta: %s', value => {
    expect(classifyQuantity(value)).toEqual({ status: 'incomplete' });
  });

  it.each([-1, -0.5])('rechaza cantidades negativas: %s', value => {
    expect(quantityError(value, false)).toBe('La cantidad debe ser mayor que 0.');
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 'abc'])(
    'clasifica como inválido un valor no finito o no numérico: %s',
    value => {
      expect(classifyQuantity(value).status).toBe('invalid');
      expect(quantityError(value, false)).toMatch(/número válido/);
    },
  );

  it('preserva la diferencia entre input vacío y cero', () => {
    expect(quantityInputValue('')).toBe('');
    expect(quantityInputValue('0')).toBe(0);
  });

  it('solo muestra error de incompleto después de solicitar validación', () => {
    expect(quantityError('', false)).toBeNull();
    expect(quantityError('', true)).toBe('La cantidad es obligatoria.');
  });

  it('valida todas las filas sin ocultar undefined o NaN', () => {
    expect(allQuantitiesValid([{ quantity: 1 }, { quantity: 2 }])).toBe(true);
    expect(allQuantitiesValid([{ quantity: 0 }, { quantity: 2 }])).toBe(false);
    expect(allQuantitiesValid([{ quantity: 1 }, { quantity: undefined }])).toBe(false);
    expect(allQuantitiesValid([{ quantity: 1 }, { quantity: Number.NaN }])).toBe(false);
  });
});
