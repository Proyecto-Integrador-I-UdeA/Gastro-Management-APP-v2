import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import app from '../../../src/app';

const prisma = new PrismaClient();
const RUN_ID = Date.now();
const TEST_PREFIX = `ppb-it-${RUN_ID}`;
const TEST_PASSWORD = 'TestPPB1234!';
const TEST_EMAIL = `${TEST_PREFIX}@test.local`;

let authToken: string;
let testUserId: number;
let testTableId: number;
let testCategoryA: number;
let testCategoryB: number;
let menuItemPizza: number;
let menuItemSalad: number;
let menuItemBeer: number;
let pricePizza: number;
let priceSalad: number;
let priceBeer: number;

async function login(): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (res.status !== 200 || !res.body?.token) throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

async function seedOrder(opts: {
  settledAt: string;
  items: Array<{ menuItemId: number; priceId: number; name: string; categoryId: number; categoryName: string; quantity: number; unitSales: number; unitBaseCost: number }>;
}) {
  const totalSales = opts.items.reduce((s, i) => s + i.unitSales * i.quantity, 0);
  const order = await prisma.salesOrder.create({
    data: {
      diningTableId: testTableId,
      status: 'SETTLED',
      openedById: testUserId,
      settledById: testUserId,
      paymentStatus: 'PAID',
      settledAt: new Date(opts.settledAt),
      openedAt: new Date(new Date(opts.settledAt).getTime() - 3_600_000),
    },
  });
  await prisma.salesPreInvoice.create({
    data: {
      salesOrderId: order.id,
      subtotalSnapshot: totalSales,
      salesAmountSnapshot: totalSales,
      consumptionTaxAmountSnapshot: 0,
      suggestedServicePercentSnapshot: 0,
      serviceAccepted: false,
      servicePercentSnapshot: 0,
      serviceAmountSnapshot: 0,
      totalSnapshot: totalSales,
      status: 'ACTIVE',
      generatedById: testUserId,
    },
  });
  for (const item of opts.items) {
    await prisma.salesOrderItem.create({
      data: {
        salesOrderId: order.id,
        menuItemId: item.menuItemId,
        menuItemPriceId: item.priceId,
        menuItemNameSnapshot: item.name,
        menuCategoryIdSnapshot: item.categoryId,
        menuCategoryNameSnapshot: item.categoryName,
        quantity: item.quantity,
        unitPriceSnapshot: item.unitSales,
        unitSalesAmountSnapshot: item.unitSales,
        unitConsumptionTaxAmountSnapshot: 0,
        currencySnapshot: 'COP',
        taxIncludedSnapshot: true,
        addedById: testUserId,
      },
    });
  }
  return order;
}

beforeAll(async () => {
  const superRole = await prisma.role.findFirstOrThrow({ where: { name: 'super' } });
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
      fullName: `PPB IT ${RUN_ID}`,
      roleId: superRole.id,
      active: true,
    },
  });
  testUserId = user.id;

  const table = await prisma.diningTable.create({
    data: { code: `PPB-${RUN_ID}-T1`, capacity: 4, active: true },
  });
  testTableId = table.id;

  const catA = await prisma.menuCategory.create({
    data: { name: `PPB-Platos-${RUN_ID}`, normalizedName: `ppb-platos-${RUN_ID}`, active: true },
  });
  testCategoryA = catA.id;

  const catB = await prisma.menuCategory.create({
    data: { name: `PPB-Bebidas-${RUN_ID}`, normalizedName: `ppb-bebidas-${RUN_ID}`, active: true },
  });
  testCategoryB = catB.id;

  // Pizza: 100 revenue, 30 cost → 30% food cost
  const pizza = await prisma.menuItem.create({
    data: { name: `Pizza-${RUN_ID}`, active: true, available: true, kind: 'STANDARD', categoryId: testCategoryA },
  });
  menuItemPizza = pizza.id;
  const priceP = await prisma.menuItemPrice.create({
    data: {
      menuItemId: pizza.id,
      baseCostSnapshot: 30,
      indirectCostSnapshot: 0,
      totalCostSnapshot: 30,
      marginRate: 0.7,
      taxRate: 0,
      priceBeforeTax: 100,
      taxAmount: 0,
      calculatedAmount: 100,
      roundingIncrement: 0.01,
      amount: 100,
      currency: 'COP',
      taxIncluded: true,
      calculationVersion: 'v1',
      createdById: testUserId,
      validFrom: new Date('2024-01-01T00:00:00.000Z'),
    },
  });
  pricePizza = priceP.id;

  // Salad: 50 revenue, 20 cost → 40% food cost (below target)
  const salad = await prisma.menuItem.create({
    data: { name: `Salad-${RUN_ID}`, active: true, available: true, kind: 'STANDARD', categoryId: testCategoryA },
  });
  menuItemSalad = salad.id;
  const priceS = await prisma.menuItemPrice.create({
    data: {
      menuItemId: salad.id,
      baseCostSnapshot: 20,
      indirectCostSnapshot: 0,
      totalCostSnapshot: 20,
      marginRate: 0.6,
      taxRate: 0,
      priceBeforeTax: 50,
      taxAmount: 0,
      calculatedAmount: 50,
      roundingIncrement: 0.01,
      amount: 50,
      currency: 'COP',
      taxIncluded: true,
      calculationVersion: 'v1',
      createdById: testUserId,
      validFrom: new Date('2024-01-01T00:00:00.000Z'),
    },
  });
  priceSalad = priceS.id;

  // Beer: 20 revenue, 4 cost → 20% food cost
  const beer = await prisma.menuItem.create({
    data: { name: `Beer-${RUN_ID}`, active: true, available: true, kind: 'STANDARD', categoryId: testCategoryB },
  });
  menuItemBeer = beer.id;
  const priceB = await prisma.menuItemPrice.create({
    data: {
      menuItemId: beer.id,
      baseCostSnapshot: 4,
      indirectCostSnapshot: 0,
      totalCostSnapshot: 4,
      marginRate: 0.8,
      taxRate: 0,
      priceBeforeTax: 20,
      taxAmount: 0,
      calculatedAmount: 20,
      roundingIncrement: 0.01,
      amount: 20,
      currency: 'COP',
      taxIncluded: true,
      calculationVersion: 'v1',
      createdById: testUserId,
      validFrom: new Date('2024-01-01T00:00:00.000Z'),
    },
  });
  priceBeer = priceB.id;

  authToken = await login();
}, 30_000);

afterAll(async () => {
  try {
    await prisma.salesOrderItem.deleteMany({ where: { salesOrder: { openedBy: { email: TEST_EMAIL } } } });
    await prisma.salesPreInvoice.deleteMany({ where: { salesOrder: { openedBy: { email: TEST_EMAIL } } } });
    await prisma.salesOrder.deleteMany({ where: { openedBy: { email: TEST_EMAIL } } });
    await prisma.menuItemPrice.deleteMany({ where: { id: { in: [pricePizza, priceSalad, priceBeer] } } });
    await prisma.menuItem.deleteMany({ where: { id: { in: [menuItemPizza, menuItemSalad, menuItemBeer] } } });
    await prisma.menuCategory.deleteMany({ where: { id: { in: [testCategoryA, testCategoryB] } } });
    await prisma.diningTable.deleteMany({ where: { id: testTableId } });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  } finally {
    await prisma.$disconnect();
  }
}, 30_000);

const auth = () => ({ Authorization: `Bearer ${authToken}` });

// ─── Auth & validación ────────────────────────────────────────────────────

describe('GET /finance/profitability/by-product — auth & validation', () => {
  const EMPTY = { from: '2040-01-01', to: '2040-01-31' };

  it('401 sin token', async () => {
    const res = await request(app).get('/finance/profitability/by-product').query(EMPTY);
    expect(res.status).toBe(401);
  });

  it('400 si from > to', async () => {
    const res = await request(app).get('/finance/profitability/by-product').set(auth()).query({
      from: '2050-01-31',
      to: '2050-01-01',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('400 si rango > 3 años', async () => {
    const res = await request(app).get('/finance/profitability/by-product').set(auth()).query({
      from: '2040-01-01',
      to: '2050-01-01',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('200 con ceros en rango vacío', async () => {
    const res = await request(app).get('/finance/profitability/by-product').set(auth()).query(EMPTY);
    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
    expect(res.body.categories).toEqual([]);
    expect(res.body.totals.totalProducts).toBe(0);
    expect(res.body.totals.revenue).toBe('0.00');
    expect(res.body.totals.profitableOrdersPct).toBe('0.00');
  });
});

// ─── Happy path con datos ────────────────────────────────────────────────

describe('GET /finance/profitability/by-product — with data', () => {
  const range = { from: '2050-01-01', to: '2050-01-31' };

  beforeAll(async () => {
    // Orden 1: 1 Pizza + 2 Beer → 100 + 40 = 140
    await seedOrder({
      settledAt: '2050-01-10T20:00:00-05:00',
      items: [
        { menuItemId: menuItemPizza, priceId: pricePizza, name: `Pizza-${RUN_ID}`, categoryId: testCategoryA, categoryName: `PPB-Platos-${RUN_ID}`, quantity: 1, unitSales: 100, unitBaseCost: 30 },
        { menuItemId: menuItemBeer, priceId: priceBeer, name: `Beer-${RUN_ID}`, categoryId: testCategoryB, categoryName: `PPB-Bebidas-${RUN_ID}`, quantity: 2, unitSales: 20, unitBaseCost: 4 },
      ],
    });
    // Orden 2: 2 Pizza + 1 Salad → 200 + 50 = 250
    await seedOrder({
      settledAt: '2050-01-20T20:00:00-05:00',
      items: [
        { menuItemId: menuItemPizza, priceId: pricePizza, name: `Pizza-${RUN_ID}`, categoryId: testCategoryA, categoryName: `PPB-Platos-${RUN_ID}`, quantity: 2, unitSales: 100, unitBaseCost: 30 },
        { menuItemId: menuItemSalad, priceId: priceSalad, name: `Salad-${RUN_ID}`, categoryId: testCategoryA, categoryName: `PPB-Platos-${RUN_ID}`, quantity: 1, unitSales: 50, unitBaseCost: 20 },
      ],
    });
  }, 30_000);

  it('agrega productos correctamente', async () => {
    const res = await request(app).get('/finance/profitability/by-product').set(auth()).query(range);
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(3);

    const pizza = res.body.products.find((p: { menuItemId: number }) => p.menuItemId === menuItemPizza)!;
    expect(pizza.unitsSold).toBe(3);
    expect(pizza.revenue).toBe('300.00');
    expect(pizza.cogsTheoretical).toBe('90.00');
    expect(pizza.grossProfit).toBe('210.00');
    expect(pizza.foodCostPct).toBe('30.00');
    expect(pizza.isBelowTarget).toBe(false);
  });

  it('ordena por revenue descendente', async () => {
    const res = await request(app).get('/finance/profitability/by-product').set(auth()).query(range);
    const revenues = res.body.products.map((p: { revenue: string }) => Number(p.revenue));
    expect(revenues).toEqual([...revenues].sort((a, b) => b - a));
  });

  it('marca productos bajo objetivo cuando food cost > 35%', async () => {
    const res = await request(app).get('/finance/profitability/by-product').set(auth()).query(range);
    const salad = res.body.products.find((p: { menuItemId: number }) => p.menuItemId === menuItemSalad)!;
    // Salad: 50 revenue, 20 cost → 40% food cost (default target 35%) → below target
    expect(salad.foodCostPct).toBe('40.00');
    expect(salad.isBelowTarget).toBe(true);
    expect(res.body.totals.productsBelowTarget).toBe(1);
    expect(res.body.totals.productsBelowTargetPct).toBe('33.33');
  });

  it('agrega por categoría correctamente', async () => {
    const res = await request(app).get('/finance/profitability/by-product').set(auth()).query(range);
    expect(res.body.categories.length).toBeGreaterThanOrEqual(2);

    const platos = res.body.categories.find((c: { categoryId: number }) => c.categoryId === testCategoryA)!;
    expect(platos).toBeDefined();
    expect(platos.productCount).toBe(2); // Pizza + Salad
    expect(platos.productsBelowTarget).toBe(1); // Salad

    const bebidas = res.body.categories.find((c: { categoryId: number }) => c.categoryId === testCategoryB)!;
    expect(bebidas).toBeDefined();
    expect(bebidas.productCount).toBe(1); // Beer
  });

  it('totales globales correctos', async () => {
    const res = await request(app).get('/finance/profitability/by-product').set(auth()).query(range);
    const totals = res.body.totals;
    // Revenue: 140 + 250 = 390
    expect(totals.revenue).toBe('390.00');
    // COGS: 30+8 + 60+20 = 118
    expect(totals.cogsTheoretical).toBe('118.00');
    expect(totals.grossProfit).toBe('272.00');
    expect(totals.totalOrders).toBe(2);
    expect(totals.profitableOrders).toBe(2);
    expect(totals.profitableOrdersPct).toBe('100.00');
    expect(totals.totalUnitsSold).toBe(6); // 1+2+2+1
  });
});

// ─── Filtros ─────────────────────────────────────────────────────────────

describe('GET /finance/profitability/by-product — filtros', () => {
  const range = { from: '2050-01-01', to: '2050-01-31' };

  it('filtra por búsqueda', async () => {
    const res = await request(app).get('/finance/profitability/by-product').set(auth()).query({
      ...range,
      search: 'Pizza',
    });
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].menuItemName).toContain('Pizza');
  });

  it('filtra por categoryId', async () => {
    const res = await request(app).get('/finance/profitability/by-product').set(auth()).query({
      ...range,
      categoryId: testCategoryA,
    });
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(2); // Pizza + Salad
    expect(res.body.products.every((p: { categoryId: number }) => p.categoryId === testCategoryA)).toBe(true);
  });

  it('búsqueda sin coincidencias → array vacío', async () => {
    const res = await request(app).get('/finance/profitability/by-product').set(auth()).query({
      ...range,
      search: 'producto-inexistente-xyz',
    });
    expect(res.status).toBe(200);
    expect(res.body.products).toEqual([]);
  });
});

// ─── Cross-check con /profitability ──────────────────────────────────────

describe('Cross-check: /by-product vs /profitability', () => {
  const range = { from: '2050-01-01', to: '2050-01-31' };

  it('revenue coincide exactamente entre ambos endpoints', async () => {
    const [byProductRes, profitabilityRes] = await Promise.all([
      request(app).get('/finance/profitability/by-product').set(auth()).query(range),
      request(app).get('/finance/profitability/summary').set(auth()).query({
        ...range,
        granularity: 'month',
      }),
    ]);

    expect(byProductRes.status).toBe(200);
    expect(profitabilityRes.status).toBe(200);

    const byProductRevenue = Number(byProductRes.body.totals.revenue);
    const profitabilityRevenue = profitabilityRes.body.currencies.reduce(
      (sum: number, c: { totals: { revenue: string } }) => sum + Number(c.totals.revenue),
      0,
    );

    expect(byProductRevenue).toBeCloseTo(profitabilityRevenue, 2);
    expect(byProductRevenue).toBe(390);
    expect(profitabilityRevenue).toBe(390);
  });

  it('currency coincide entre ambos endpoints', async () => {
    const [byProductRes, profitabilityRes] = await Promise.all([
      request(app).get('/finance/profitability/by-product').set(auth()).query(range),
      request(app).get('/finance/profitability/summary').set(auth()).query({
        ...range,
        granularity: 'month',
      }),
    ]);

    const byProductCurrency = byProductRes.body.totals.currency;
    const profitabilityCurrencies = profitabilityRes.body.currencies.map(
      (c: { currency: string }) => c.currency,
    );
    expect(profitabilityCurrencies).toContain(byProductCurrency);
  });
});