import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSalesAnalytics } from '../../src/services/sales/salesAnalyticsService';

const order = {
  id: 42,
  settledAt: new Date('2026-09-18T17:00:00.000Z'),
  diningTable: { code: 'M1' },
  items: [
    {
      id: 1, menuItemId: 10, menuItemNameSnapshot: 'Plato', menuCategoryIdSnapshot: 7,
      menuCategoryNameSnapshot: 'Fuertes', parentItemId: null, quantity: 2,
      unitPriceSnapshot: new Prisma.Decimal('54.00'), unitSalesAmountSnapshot: new Prisma.Decimal('50.00'),
      unitConsumptionTaxAmountSnapshot: new Prisma.Decimal('4.00'), currencySnapshot: 'COP',
    },
    {
      id: 2, menuItemId: 11, menuItemNameSnapshot: 'Salsa', menuCategoryIdSnapshot: 7,
      menuCategoryNameSnapshot: 'Fuertes', parentItemId: 1, quantity: 1,
      unitPriceSnapshot: new Prisma.Decimal('10.80'), unitSalesAmountSnapshot: new Prisma.Decimal('10.00'),
      unitConsumptionTaxAmountSnapshot: new Prisma.Decimal('0.80'), currencySnapshot: 'COP',
    },
  ],
  preInvoices: [{ salesAmountSnapshot: new Prisma.Decimal('110.00'), consumptionTaxAmountSnapshot: new Prisma.Decimal('8.80'), serviceAmountSnapshot: new Prisma.Decimal('11.88'), totalSnapshot: new Prisma.Decimal('130.68') }],
};

describe('sales analytics service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T15:00:00.000Z'));
  });

  it('separa venta, impuesto, servicio y total, y excluye adiciones del ranking principal', async () => {
    const findMany = vi.fn().mockResolvedValue([order]);
    const result = await getSalesAnalytics({ period: 'day' }, { salesOrder: { findMany } } as never);
    const currency = result.currencies[0];
    expect(currency.summary).toEqual({ salesAmount: '110.00', consumptionTaxAmount: '8.80', serviceAmount: '11.88', totalCollected: '130.68', closedOrders: 1, unitsSold: 3 });
    expect(currency.products).toHaveLength(1);
    expect(currency.products[0]).toMatchObject({ menuItemId: 10, quantity: 2, salesAmount: '100.00', consumptionTaxAmount: '8.00', grossAmount: '108.00', consumptionSubtotal: '108.00' });
    expect(currency.additions[0]).toMatchObject({ menuItemId: 11, quantity: 1, salesAmount: '10.00' });
    expect(currency.categories[0]).toMatchObject({ categoryId: 7, categoryName: 'Fuertes', quantity: 3 });
    expect(findMany).toHaveBeenCalledTimes(3);
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      status: 'SETTLED',
      paymentStatus: 'PAID',
      settledAt: {
        gte: new Date('2026-09-18T05:00:00.000Z'),
        lt: new Date('2026-09-19T05:00:00.000Z'),
      },
    });
    expect(findMany.mock.calls[2][0].where).toMatchObject({
      status: 'SETTLED',
      paymentStatus: 'PAID',
      settledAt: { not: null },
    });
    expect(result.filterOptions).toEqual({ products: [{ menuItemId: 10, name: 'Plato' }], categories: [{ categoryId: 7, name: 'Fuertes' }], years: [2026] });
  });

  it('aplica filtro de producto y mantiene YTD independiente', async () => {
    const result = await getSalesAnalytics({ period: 'day', menuItemId: 10 }, { salesOrder: { findMany: vi.fn().mockResolvedValue([order]) } } as never);
    expect(result.currencies[0].products).toHaveLength(1);
    expect(result.currencies[0].additions).toHaveLength(0);
    expect(result.yearToDate.currencies[0].additions).toHaveLength(1);
  });

  it('califica la orden completa pero filtra únicamente las tablas analíticas', async () => {
    const filteredOrder = {
      ...order,
      items: [
        { ...order.items[0], quantity: 1, menuItemNameSnapshot: 'Producto A', menuCategoryIdSnapshot: 7, menuCategoryNameSnapshot: 'Categoría A' },
        { ...order.items[0], id: 3, menuItemId: 12, menuItemNameSnapshot: 'Producto B', menuCategoryIdSnapshot: 8, menuCategoryNameSnapshot: 'Categoría B', quantity: 2, parentItemId: null },
      ],
      preInvoices: [{ ...order.preInvoices[0], salesAmountSnapshot: new Prisma.Decimal('150.00'), consumptionTaxAmountSnapshot: new Prisma.Decimal('12.00'), serviceAmountSnapshot: new Prisma.Decimal('15.00'), totalSnapshot: new Prisma.Decimal('177.00') }],
    };
    const result = await getSalesAnalytics({ period: 'day', menuItemId: 10 }, { salesOrder: { findMany: vi.fn().mockResolvedValue([filteredOrder]) } } as never);
    const currency = result.currencies[0];

    expect(currency.summary).toEqual({ salesAmount: '150.00', consumptionTaxAmount: '12.00', serviceAmount: '15.00', totalCollected: '177.00', closedOrders: 1, unitsSold: 3 });
    expect(currency.details[0].items).toEqual([
      { name: 'Producto A', quantity: 1, isAddition: false },
      { name: 'Producto B', quantity: 2, isAddition: false },
    ]);
    expect(currency.products).toHaveLength(1);
    expect(currency.products[0]).toMatchObject({ menuItemId: 10, name: 'Producto A', quantity: 1 });
    expect(currency.categories).toHaveLength(1);
    expect(currency.categories[0]).toMatchObject({ categoryId: 7, categoryName: 'Categoría A', quantity: 1 });
    expect(currency.additions).toHaveLength(0);
    expect(result.yearToDate.currencies[0].products).toHaveLength(2);
    expect(result.yearToDate.currencies[0].summary.totalCollected).toBe('177.00');
  });

  it('califica la orden completa con un filtro de categoría sin asignar servicio a la categoría', async () => {
    const categoryOrder = {
      ...order,
      items: [
        { ...order.items[0], quantity: 1, menuItemNameSnapshot: 'Producto A', menuCategoryIdSnapshot: 7, menuCategoryNameSnapshot: 'Categoría A' },
        { ...order.items[0], id: 3, menuItemId: 12, menuItemNameSnapshot: 'Producto B', menuCategoryIdSnapshot: 8, menuCategoryNameSnapshot: 'Categoría B', quantity: 2, parentItemId: null },
      ],
    };
    const result = await getSalesAnalytics({ period: 'day', categoryId: 7 }, { salesOrder: { findMany: vi.fn().mockResolvedValue([categoryOrder]) } } as never);
    const currency = result.currencies[0];

    expect(currency.summary.serviceAmount).toBe('11.88');
    expect(currency.summary.unitsSold).toBe(3);
    expect(currency.products.map(product => product.name)).toEqual(['Producto A']);
    expect(currency.categories.map(category => category.categoryName)).toEqual(['Categoría A']);
  });

  it('mantiene separados los resultados de monedas distintas y calcula YTD desde el 1 de enero', async () => {
    const usdOrder = {
      ...order,
      id: 43,
      items: order.items.map(item => ({ ...item, currencySnapshot: 'USD' })),
      preInvoices: [{ ...order.preInvoices[0], salesAmountSnapshot: new Prisma.Decimal('20.00'), consumptionTaxAmountSnapshot: new Prisma.Decimal('1.60'), serviceAmountSnapshot: new Prisma.Decimal('2.16'), totalSnapshot: new Prisma.Decimal('23.76') }],
    };
    const findMany = vi.fn().mockResolvedValue([order, usdOrder]);
    const result = await getSalesAnalytics({ period: 'day' }, { salesOrder: { findMany } } as never);

    expect(result.currencies.map(currency => currency.currency).sort()).toEqual(['COP', 'USD']);
    expect(result.currencies.find(currency => currency.currency === 'USD')?.summary.totalCollected).toBe('23.76');
    expect(findMany.mock.calls[1][0].where.settledAt).toEqual({
      gte: new Date('2026-01-01T05:00:00.000Z'),
      lt: new Date('2026-09-19T05:00:00.000Z'),
    });
  });

  it('resuelve periodos históricos de día, semana, mes, año y rango personalizado', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const client = { salesOrder: { findMany } } as never;
    const cases = [
      [{ period: 'day', date: '2025-02-12' }, '2025-02-12', '2025-02-12'],
      [{ period: 'week', week: '2025-02-12' }, '2025-02-10', '2025-02-16'],
      [{ period: 'month', month: '2025-02' }, '2025-02-01', '2025-02-28'],
      [{ period: 'year', year: '2025' }, '2025-01-01', '2025-12-31'],
      [{ period: 'custom', from: '2025-02-12', to: '2025-02-14' }, '2025-02-12', '2025-02-14'],
    ] as const;
    for (const [query, from, to] of cases) {
      const result = await getSalesAnalytics(query as never, client);
      expect(result.period).toMatchObject({ from, to });
    }
  });

  it('construye opciones históricas, excluye adiciones y no ofrece categorías nulas', async () => {
    const historicalOrder = {
      ...order,
      id: 77,
      settledAt: new Date('2024-03-02T17:00:00.000Z'),
      items: [
        { ...order.items[0], menuItemId: 99, menuItemNameSnapshot: 'Producto antiguo', menuCategoryIdSnapshot: null, menuCategoryNameSnapshot: null, parentItemId: null },
        { ...order.items[1], menuItemId: 100, menuItemNameSnapshot: 'Adición antigua', menuCategoryIdSnapshot: 12, menuCategoryNameSnapshot: 'Adiciones', parentItemId: 1 },
      ],
    };
    const findMany = vi.fn().mockImplementation(async (args: { where?: { settledAt?: { not?: null } } }) => args.where?.settledAt?.not === null ? [historicalOrder] : []);
    const result = await getSalesAnalytics({ period: 'year', year: '2024' }, { salesOrder: { findMany } } as never);

    expect(result.filterOptions.products).toEqual([{ menuItemId: 99, name: 'Producto antiguo' }]);
    expect(result.filterOptions.categories).toEqual([{ categoryId: 12, name: 'Adiciones' }]);
    expect(result.filterOptions.years).toEqual([2026, 2024]);
  });
});
