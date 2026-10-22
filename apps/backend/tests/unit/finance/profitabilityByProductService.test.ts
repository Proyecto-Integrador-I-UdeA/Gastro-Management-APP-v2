import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import type {
  OrderRevenueRow,
  ProductLineRow,
  ProfitabilityByProductDataSource,
  ProfitabilityConfigRow,
} from '../../../src/services/finance/profitabilityByProductService';
import { getProfitabilityByProduct } from '../../../src/services/finance/profitabilityByProductService';

function fakeSource(data: {
  lines?: ProductLineRow[];
  revenues?: OrderRevenueRow[];
  config?: ProfitabilityConfigRow[];
}): ProfitabilityByProductDataSource {
  return {
    loadProductLines: async () => data.lines ?? [],
    loadOrderRevenues: async () => data.revenues ?? [],
    loadConfig: async () => data.config ?? [],
  };
}

function line(overrides: Partial<ProductLineRow> = {}): ProductLineRow {
  return {
    orderId: 1,
    settledAt: new Date('2026-03-15T20:00:00.000-05:00'),
    currency: 'COP',
    menuItemId: 10,
    menuItemName: 'Milanesa',
    categoryId: 1,
    categoryName: 'Principales',
    quantity: 1,
    unitSalesAmount: new Prisma.Decimal(100),
    unitBaseCost: new Prisma.Decimal(30),
    ...overrides,
  };
}

function revenue(overrides: Partial<OrderRevenueRow> = {}): OrderRevenueRow {
  return {
    orderId: 1,
    settledAt: new Date('2026-03-15T20:00:00.000-05:00'),
    currency: 'COP',
    revenue: new Prisma.Decimal(100),
    ...overrides,
  };
}

const defaultQuery = { from: '2026-03-01', to: '2026-03-31' };

// ─── Agregados por producto ───────────────────────────────────────────────

describe('profitabilityByProductService · productos', () => {
  it('agrega revenue y cogs por producto', async () => {
    const source = fakeSource({
      lines: [
        line({ menuItemId: 10, menuItemName: 'Milanesa', quantity: 2, unitSalesAmount: new Prisma.Decimal(100), unitBaseCost: new Prisma.Decimal(30) }),
        line({ orderId: 2, menuItemId: 10, menuItemName: 'Milanesa', quantity: 1, unitSalesAmount: new Prisma.Decimal(100), unitBaseCost: new Prisma.Decimal(30) }),
        line({ menuItemId: 20, menuItemName: 'Ensalada', quantity: 3, unitSalesAmount: new Prisma.Decimal(50), unitBaseCost: new Prisma.Decimal(15) }),
      ],
    });
    const result = await getProfitabilityByProduct(defaultQuery, source);
    expect(result.products).toHaveLength(2);

    const milanesa = result.products.find(p => p.menuItemId === 10)!;
    expect(milanesa.unitsSold).toBe(3);
    expect(milanesa.revenue).toBe('300.00'); // 2*100 + 1*100
    expect(milanesa.cogsTheoretical).toBe('90.00'); // 3*30
    expect(milanesa.grossProfit).toBe('210.00');
    expect(milanesa.grossMarginPct).toBe('70.00');
    expect(milanesa.foodCostPct).toBe('30.00');
    expect(milanesa.orderCount).toBe(2); // 2 órdenes distintas
  });

  it('ordena por revenue descendente', async () => {
    const source = fakeSource({
      lines: [
        line({ menuItemId: 1, menuItemName: 'Chico', quantity: 1, unitSalesAmount: new Prisma.Decimal(10) }),
        line({ menuItemId: 2, menuItemName: 'Grande', quantity: 5, unitSalesAmount: new Prisma.Decimal(200) }),
        line({ menuItemId: 3, menuItemName: 'Medio', quantity: 2, unitSalesAmount: new Prisma.Decimal(50) }),
      ],
    });
    const result = await getProfitabilityByProduct(defaultQuery, source);
    expect(result.products.map(p => p.menuItemName)).toEqual(['Grande', 'Medio', 'Chico']);
  });

  it('isBelowTarget=true cuando foodCostPct > umbral', async () => {
    const source = fakeSource({
      lines: [
        // Food cost 50% → below target (default 35%)
        line({ menuItemId: 1, menuItemName: 'Caro', unitSalesAmount: new Prisma.Decimal(100), unitBaseCost: new Prisma.Decimal(50) }),
        // Food cost 20% → OK
        line({ menuItemId: 2, menuItemName: 'Barato', unitSalesAmount: new Prisma.Decimal(100), unitBaseCost: new Prisma.Decimal(20) }),
      ],
    });
    const result = await getProfitabilityByProduct(defaultQuery, source);
    const caro = result.products.find(p => p.menuItemName === 'Caro')!;
    const barato = result.products.find(p => p.menuItemName === 'Barato')!;
    expect(caro.isBelowTarget).toBe(true);
    expect(barato.isBelowTarget).toBe(false);
  });

  it('filtra por búsqueda', async () => {
    const source = fakeSource({
      lines: [
        line({ menuItemId: 1, menuItemName: 'Milanesa' }),
        line({ menuItemId: 2, menuItemName: 'Ensalada' }),
      ],
    });
    const result = await getProfitabilityByProduct(
      { ...defaultQuery, search: 'mila' },
      source,
    );
    expect(result.products).toHaveLength(1);
    expect(result.products[0].menuItemName).toBe('Milanesa');
  });

  it('filtra por categoryId', async () => {
    const source = fakeSource({
      lines: [
        line({ menuItemId: 1, categoryId: 1, categoryName: 'Principales' }),
        line({ menuItemId: 2, categoryId: 2, categoryName: 'Bebidas' }),
      ],
    });
    const result = await getProfitabilityByProduct(
      { ...defaultQuery, categoryId: 1 },
      source,
    );
    expect(result.products).toHaveLength(1);
    expect(result.products[0].categoryId).toBe(1);
  });
});

// ─── Agregados por categoría ──────────────────────────────────────────────

describe('profitabilityByProductService · categorías', () => {
  it('agrega correctamente por categoría', async () => {
    const source = fakeSource({
      lines: [
        line({ menuItemId: 1, categoryId: 1, categoryName: 'Principales', quantity: 2, unitSalesAmount: new Prisma.Decimal(100), unitBaseCost: new Prisma.Decimal(30) }),
        line({ menuItemId: 2, categoryId: 1, categoryName: 'Principales', quantity: 1, unitSalesAmount: new Prisma.Decimal(50), unitBaseCost: new Prisma.Decimal(15) }),
        line({ menuItemId: 3, categoryId: 2, categoryName: 'Bebidas', quantity: 3, unitSalesAmount: new Prisma.Decimal(10), unitBaseCost: new Prisma.Decimal(3) }),
      ],
    });
    const result = await getProfitabilityByProduct(defaultQuery, source);
    expect(result.categories).toHaveLength(2);

    const principales = result.categories.find(c => c.categoryName === 'Principales')!;
    expect(principales.unitsSold).toBe(3);
    expect(principales.productCount).toBe(2);
    expect(principales.revenue).toBe('250.00'); // 2*100 + 1*50
    expect(principales.cogsTheoretical).toBe('75.00'); // 2*30 + 1*15
    expect(principales.grossProfit).toBe('175.00');
  });
});

// ─── KPIs ejecutivos ──────────────────────────────────────────────────────

describe('profitabilityByProductService · KPIs ejecutivos', () => {
  it('calcula profitableOrders / totalOrders correctamente', async () => {
    const source = fakeSource({
      lines: [
        line({ orderId: 1, menuItemId: 1, quantity: 1, unitSalesAmount: new Prisma.Decimal(100), unitBaseCost: new Prisma.Decimal(30) }),
        line({ orderId: 2, menuItemId: 1, quantity: 1, unitSalesAmount: new Prisma.Decimal(50), unitBaseCost: new Prisma.Decimal(60) }), // negative margin
      ],
      revenues: [
        revenue({ orderId: 1, revenue: new Prisma.Decimal(100) }),
        revenue({ orderId: 2, revenue: new Prisma.Decimal(50) }),
      ],
    });
    const result = await getProfitabilityByProduct(defaultQuery, source);
    expect(result.totals.totalOrders).toBe(2);
    expect(result.totals.profitableOrders).toBe(1);
    expect(result.totals.profitableOrdersPct).toBe('50.00');
  });

  it('cuenta productosBelowTarget correctamente', async () => {
    const source = fakeSource({
      lines: [
        line({ menuItemId: 1, unitSalesAmount: new Prisma.Decimal(100), unitBaseCost: new Prisma.Decimal(20) }), // 20% → OK
        line({ menuItemId: 2, unitSalesAmount: new Prisma.Decimal(100), unitBaseCost: new Prisma.Decimal(50) }), // 50% → below target
        line({ menuItemId: 3, unitSalesAmount: new Prisma.Decimal(100), unitBaseCost: new Prisma.Decimal(40) }), // 40% → below target
      ],
    });
    const result = await getProfitabilityByProduct(defaultQuery, source);
    expect(result.totals.totalProducts).toBe(3);
    expect(result.totals.productsBelowTarget).toBe(2);
    expect(result.totals.productsBelowTargetPct).toBe('66.67');
  });

  it('usa defaults si config está vacío', async () => {
    const source = fakeSource({
      lines: [line({ unitSalesAmount: new Prisma.Decimal(100), unitBaseCost: new Prisma.Decimal(20) })],
    });
    const result = await getProfitabilityByProduct(defaultQuery, source);
    expect(result.targets.foodCostTargetPct).toBe('35.00');
    expect(result.targets.productMarginTargetPct).toBe('65.00');
  });

  it('usa config custom si está definido', async () => {
    const source = fakeSource({
      lines: [line({ unitSalesAmount: new Prisma.Decimal(100), unitBaseCost: new Prisma.Decimal(40) })], // 40%
      config: [
        { key: 'finance.food_cost_target_pct', value: '45' },
        { key: 'finance.product_margin_target_pct', value: '55' },
      ],
    });
    const result = await getProfitabilityByProduct(defaultQuery, source);
    expect(result.targets.foodCostTargetPct).toBe('45.00');
    expect(result.targets.productMarginTargetPct).toBe('55.00');
    // 40% < 45% → NOT below target
    expect(result.products[0].isBelowTarget).toBe(false);
  });

  it('config inválido → usa default (defensa)', async () => {
    const source = fakeSource({
      config: [
        { key: 'finance.food_cost_target_pct', value: 'not-a-number' },
        { key: 'finance.product_margin_target_pct', value: '-10' },
      ],
    });
    const result = await getProfitabilityByProduct(defaultQuery, source);
    expect(result.targets.foodCostTargetPct).toBe('35.00');
    expect(result.targets.productMarginTargetPct).toBe('65.00');
  });
});

// ─── Casos borde ──────────────────────────────────────────────────────────

describe('profitabilityByProductService · casos borde', () => {
  it('sin productos → totals en 0', async () => {
    const result = await getProfitabilityByProduct(defaultQuery, fakeSource({}));
    expect(result.products).toEqual([]);
    expect(result.categories).toEqual([]);
    expect(result.totals.revenue).toBe('0.00');
    expect(result.totals.totalProducts).toBe(0);
    expect(result.totals.profitableOrdersPct).toBe('0.00');
    expect(result.totals.productsBelowTargetPct).toBe('0.00');
  });

  it('producto sin revenue (solo cogs) no divide por cero', async () => {
    const source = fakeSource({
      lines: [line({ unitSalesAmount: new Prisma.Decimal(0), unitBaseCost: new Prisma.Decimal(10), quantity: 1 })],
    });
    const result = await getProfitabilityByProduct(defaultQuery, source);
    expect(result.products[0].foodCostPct).toBe('0.00');
    expect(result.products[0].grossMarginPct).toBe('0.00');
  });

  it('period refleja el query original', async () => {
    const result = await getProfitabilityByProduct(
      { from: '2026-03-15', to: '2026-03-20' },
      fakeSource({}),
    );
    expect(result.period).toEqual({ from: '2026-03-15', to: '2026-03-20' });
  });
});
