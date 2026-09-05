import { describe, expect, it } from 'vitest';
import {
  createMenuCategorySchema,
  updateMenuCategorySchema,
} from '../../src/schemas/menuCategorySchema';
import { normalizeMenuCategoryName } from '../../src/services/menuCategoryService';

describe('normalización de categorías de menú', () => {
  it.each([
    [' Bebidas ', 'bebidas'],
    ['BEBIDAS', 'bebidas'],
    ['  Platos Fuertes  ', 'platos fuertes'],
  ])('normaliza %j como %j', (input, expected) => {
    expect(normalizeMenuCategoryName(input)).toBe(expected);
  });
});

describe('validación de categorías de menú', () => {
  it.each(['', '   '])('rechaza un nombre vacío: %j', name => {
    expect(createMenuCategorySchema.safeParse({ name }).success).toBe(false);
  });

  it('rechaza displayOrder negativo', () => {
    expect(createMenuCategorySchema.safeParse({
      name: 'Bebidas',
      displayOrder: -1,
    }).success).toBe(false);
  });

  it('rechaza displayOrder decimal', () => {
    expect(updateMenuCategorySchema.safeParse({
      displayOrder: 1.5,
    }).success).toBe(false);
  });

  it('no acepta normalizedName suministrado por el cliente', () => {
    expect(createMenuCategorySchema.safeParse({
      name: 'Bebidas',
      normalizedName: 'valor-no-confiable',
    }).success).toBe(false);
  });
});

