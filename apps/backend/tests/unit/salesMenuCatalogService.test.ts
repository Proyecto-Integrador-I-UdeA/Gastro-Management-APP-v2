import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  buildSalesMenuCatalog,
  SalesMenuCatalogInconsistencyError,
  SalesMenuCatalogRecord,
} from '../../src/services/sales/salesMenuCatalogService';

const validFrom = new Date('2026-09-06T12:00:00.000Z');

function record(
  overrides: Partial<SalesMenuCatalogRecord> = {},
): SalesMenuCatalogRecord {
  return {
    id: 1,
    name: 'Ajiaco',
    description: 'Plato del día',
    active: true,
    kind: 'STANDARD',
    available: true,
    includedItemsText: null,
    categoryId: 10,
    category: {
      id: 10,
      name: 'Platos fuertes',
      displayOrder: 1,
      active: true,
    },
    prices: [{
      amount: new Prisma.Decimal('34000.00'),
      currency: 'COP',
      taxIncluded: true,
      validFrom,
      validUntil: null,
    }],
    ...overrides,
  };
}

describe('catálogo operacional de ventas', () => {
  it('incluye MenuItem activo con categoría activa y precio vigente', () => {
    const catalog = buildSalesMenuCatalog([record()]);

    expect(catalog.categories).toHaveLength(1);
    expect(catalog.categories[0].items[0].name).toBe('Ajiaco');
  });

  it('excluye MenuItem inactivo', () => {
    expect(buildSalesMenuCatalog([record({ active: false })]).categories).toEqual([]);
  });

  it('excluye MenuItem con categoría inactiva', () => {
    expect(buildSalesMenuCatalog([record({
      category: {
        id: 10,
        name: 'Platos fuertes',
        displayOrder: 1,
        active: false,
      },
    })]).categories).toEqual([]);
  });

  it('excluye MenuItem sin categoría', () => {
    expect(buildSalesMenuCatalog([record({
      categoryId: null,
      category: null,
    })]).categories).toEqual([]);
  });

  it('excluye MenuItem sin precio', () => {
    expect(buildSalesMenuCatalog([record({ prices: [] })]).categories).toEqual([]);
  });

  it('excluye MenuItem que solo tiene precio histórico', () => {
    expect(buildSalesMenuCatalog([record({
      prices: [{
        amount: '30000.00',
        currency: 'COP',
        taxIncluded: true,
        validFrom,
        validUntil: new Date('2026-09-06T13:00:00.000Z'),
      }],
    })]).categories).toEqual([]);
  });

  it('usa exclusivamente el precio con validUntil null', () => {
    const catalog = buildSalesMenuCatalog([record({
      prices: [
        {
          amount: '30000.00',
          currency: 'COP',
          taxIncluded: true,
          validFrom: new Date('2026-09-05T12:00:00.000Z'),
          validUntil: new Date('2026-09-06T11:00:00.000Z'),
        },
        {
          amount: '34000.00',
          currency: 'COP',
          taxIncluded: true,
          validFrom,
          validUntil: null,
        },
      ],
    })]);

    expect(catalog.categories[0].items[0].price.amount).toBe('34000.00');
  });

  it('construye un DTO comercial sin costos, márgenes ni auditoría interna', () => {
    const item = buildSalesMenuCatalog([record()]).categories[0].items[0];

    expect(item).toEqual({
      id: 1,
      name: 'Ajiaco',
      description: 'Plato del día',
      kind: 'STANDARD',
      available: true,
      includedItemsText: null,
      category: { id: 10, name: 'Platos fuertes' },
      price: {
        amount: '34000.00',
        currency: 'COP',
        taxIncluded: true,
        validFrom: '2026-09-06T12:00:00.000Z',
      },
    });
  });

  it('mantiene en el catálogo un item activo temporalmente agotado', () => {
    const item = buildSalesMenuCatalog([record({
      available: false,
      includedItemsText: 'Incluye sopa y bebida.',
    })]).categories[0].items[0];

    expect(item.available).toBe(false);
    expect(item.includedItemsText).toBe('Incluye sopa y bebida.');
  });

  it('ordena categorías por displayOrder, name e id', () => {
    const catalog = buildSalesMenuCatalog([
      record({
        id: 3,
        categoryId: 30,
        category: { id: 30, name: 'Postres', displayOrder: 2, active: true },
      }),
      record({
        id: 2,
        categoryId: 20,
        category: { id: 20, name: 'Bebidas', displayOrder: 1, active: true },
      }),
      record({
        id: 1,
        categoryId: 10,
        category: { id: 10, name: 'Entradas', displayOrder: 1, active: true },
      }),
    ]);

    expect(catalog.categories.map(category => category.name))
      .toEqual(['Bebidas', 'Entradas', 'Postres']);
  });

  it('ordena items por name e id', () => {
    const catalog = buildSalesMenuCatalog([
      record({ id: 3, name: 'Sopa' }),
      record({ id: 2, name: 'Ajiaco' }),
      record({ id: 1, name: 'Ajiaco' }),
    ]);

    expect(catalog.categories[0].items.map(item => item.id)).toEqual([1, 2, 3]);
  });

  it('devuelve categories vacío cuando no hay productos vendibles', () => {
    expect(buildSalesMenuCatalog([])).toEqual({ categories: [] });
  });

  it('señala la inconsistencia de múltiples precios vigentes', () => {
    const duplicatedCurrentPrice = record().prices[0];

    expect(() => buildSalesMenuCatalog([record({
      prices: [duplicatedCurrentPrice, { ...duplicatedCurrentPrice }],
    })])).toThrow(SalesMenuCatalogInconsistencyError);
  });
});
