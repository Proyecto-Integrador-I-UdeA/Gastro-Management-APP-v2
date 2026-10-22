import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import app from '../../../src/app';

const prisma = new PrismaClient();
const RUN_ID = Date.now();
const TEST_PREFIX = `prof-it-${RUN_ID}`;
const TEST_PASSWORD = 'TestProf1234!';
const TEST_EMAIL = `${TEST_PREFIX}@test.local`;

let authToken: string;
let testUserId: number;
let testTableId: number;
let testMenuItemId: number;
let testMenuItemPriceId: number;

async function login(): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (res.status !== 200 || !res.body?.token) throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

async function seedOrder(opts: {
  settledAt: string;
  revenue: number;
  tax: number;
  quantity?: number;
  baseCostUnit?: number;
}) {
  const subtotal = opts.revenue + opts.tax;
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
      subtotalSnapshot: subtotal,
      salesAmountSnapshot: opts.revenue,
      consumptionTaxAmountSnapshot: opts.tax,
      suggestedServicePercentSnapshot: 0,
      serviceAccepted: false,
      servicePercentSnapshot: 0,
      serviceAmountSnapshot: 0,
      totalSnapshot: subtotal,
      status: 'ACTIVE',
      generatedById: testUserId,
    },
  });
  if (opts.quantity !== undefined && opts.baseCostUnit !== undefined) {
    await prisma.salesOrderItem.create({
      data: {
        salesOrderId: order.id,
        menuItemId: testMenuItemId,
        menuItemPriceId: testMenuItemPriceId,
        menuItemNameSnapshot: 'Test Item',
        quantity: opts.quantity,
        unitPriceSnapshot: opts.revenue + opts.tax,
        unitSalesAmountSnapshot: opts.revenue,
        unitConsumptionTaxAmountSnapshot: opts.tax,
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
      fullName: `Prof IT ${RUN_ID}`,
      roleId: superRole.id,
      active: true,
    },
  });
  testUserId = user.id;

  const table = await prisma.diningTable.create({
    data: { code: `IT-${RUN_ID}-T`, capacity: 4, active: true },
  });
  testTableId = table.id;

  const category = await prisma.menuCategory.create({
    data: { name: `IT Cat ${RUN_ID}`, normalizedName: `it-cat-${RUN_ID}`, active: true },
  });
  const item = await prisma.menuItem.create({
    data: { name: `IT Item ${RUN_ID}`, active: true, available: true, kind: 'STANDARD', categoryId: category.id },
  });
  testMenuItemId = item.id;
  const price = await prisma.menuItemPrice.create({
    data: {
      menuItemId: item.id,
      baseCostSnapshot: 30,
      indirectCostSnapshot: 0,
      totalCostSnapshot: 30,
      marginRate: 0.7,
      taxRate: 0.08,
      priceBeforeTax: 100,
      taxAmount: 8,
      calculatedAmount: 108,
      roundingIncrement: 0.01,
      amount: 108,
      currency: 'COP',
      taxIncluded: true,
      calculationVersion: 'v1',
      createdById: testUserId,
      validFrom: new Date('2024-01-01T00:00:00.000Z'),
    },
  });
  testMenuItemPriceId = price.id;

  authToken = await login();
}, 30_000);

afterAll(async () => {
  try {
    await prisma.salesOrderItem.deleteMany({ where: { salesOrder: { openedBy: { email: TEST_EMAIL } } } });
    await prisma.salesPreInvoice.deleteMany({ where: { salesOrder: { openedBy: { email: TEST_EMAIL } } } });
    await prisma.salesOrder.deleteMany({ where: { openedBy: { email: TEST_EMAIL } } });
    await prisma.menuItemPrice.deleteMany({ where: { id: testMenuItemPriceId } });
    await prisma.menuItem.deleteMany({ where: { id: testMenuItemId } });
    await prisma.menuCategory.deleteMany({ where: { normalizedName: `it-cat-${RUN_ID}` } });
    await prisma.diningTable.deleteMany({ where: { id: testTableId } });
    await prisma.operationalCostConfig.deleteMany({ where: { month: { startsWith: '2050-' } } });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  } finally {
    await prisma.$disconnect();
  }
}, 30_000);

const auth = () => ({ Authorization: `Bearer ${authToken}` });

// ─── Grupo 1: Auth + validación (sin datos) ─────────────────────────────

describe('GET /finance/profitability/summary — auth & validation', () => {
  const EMPTY = { from: '2040-01-01', to: '2040-01-31' };

  it('returns 401 without token', async () => {
    const res = await request(app).get('/finance/profitability/summary').query(EMPTY);
    expect(res.status).toBe(401);
  });

  it('returns 400 when from > to', async () => {
    const res = await request(app).get('/finance/profitability/summary').set(auth()).query({
      from: '2050-01-31', to: '2050-01-01',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when range exceeds 5 years', async () => {
    const res = await request(app).get('/finance/profitability/summary').set(auth()).query({
      from: '2040-01-01', to: '2050-01-01',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid date', async () => {
    const res = await request(app).get('/finance/profitability/summary').set(auth()).query({
      from: 'not-a-date', to: '2050-01-31',
    });
    expect(res.status).toBe(400);
  });

  it('returns empty currencies when no data', async () => {
    const res = await request(app).get('/finance/profitability/summary').set(auth()).query(EMPTY);
    expect(res.status).toBe(200);
    expect(res.body.currencies).toEqual([]);
    expect(res.body.period.granularity).toBe('month');
  });
});

// ─── Grupo 2: Revenue puro (sin COGS, sin gastos) ───────────────────────

describe('GET /finance/profitability/summary — revenue only', () => {
  const range = { from: '2050-01-01', to: '2050-01-31' };

  beforeAll(async () => {
    await seedOrder({ settledAt: '2050-01-10T20:00:00-05:00', revenue: 100, tax: 8 });
    await seedOrder({ settledAt: '2050-01-20T20:00:00-05:00', revenue: 200, tax: 16 });
  }, 30_000);

  it('computes revenue totals correctly', async () => {
    const res = await request(app).get('/finance/profitability/summary').set(auth()).query(range);
    expect(res.status).toBe(200);
    expect(res.body.currencies).toHaveLength(1);
    const cop = res.body.currencies[0];
    expect(cop.currency).toBe('COP');
    expect(cop.totals.revenue).toBe('300.00');
  });

  it('without COGS and expenses: gross = revenue, operating = revenue', async () => {
    const res = await request(app).get('/finance/profitability/summary').set(auth()).query(range);
    const cop = res.body.currencies[0];
    expect(cop.totals.cogsReal).toBe('0.00');
    expect(cop.totals.grossProfit).toBe('300.00');
    expect(cop.totals.operatingProfit).toBe('300.00');
    expect(cop.totals.grossMarginPct).toBe('100.00');
    expect(cop.totals.operatingMarginPct).toBe('100.00');
  });

  it('hasData = false when no operational costs in period', async () => {
    const res = await request(app).get('/finance/profitability/summary').set(auth()).query(range);
    expect(res.body.currencies[0].totals.operatingExpenses.hasData).toBe(false);
  });

  it('bucket by month returns one bucket with correct totals', async () => {
    const res = await request(app).get('/finance/profitability/summary').set(auth()).query(range);
    const buckets = res.body.currencies[0].buckets;
    expect(buckets).toHaveLength(1);
    expect(buckets[0].period).toBe('2050-01');
    expect(buckets[0].revenue).toBe('300.00');
  });
});

// ─── Grupo 3: COGS teórico (con sales_order_items) ──────────────────────
// FIX #1: 2050 no es bisiesto → 2050-02-29 NO existe. Rango corregido a 2050-02-28.

describe('GET /finance/profitability/summary — COGS theoretical', () => {
  const range = { from: '2050-02-01', to: '2050-02-28' };

  beforeAll(async () => {
    // Orden con 2 unidades a baseCost=30 → teórico = 60
    await seedOrder({
      settledAt: '2050-02-10T20:00:00-05:00',
      revenue: 200, tax: 16,
      quantity: 2, baseCostUnit: 30,
    });
    // Orden con 1 unidad a baseCost=30 → teórico = 30
    await seedOrder({
      settledAt: '2050-02-15T20:00:00-05:00',
      revenue: 100, tax: 8,
      quantity: 1, baseCostUnit: 30,
    });
  }, 30_000);

  it('computes COGS theoretical from sales_order_items', async () => {
    const res = await request(app).get('/finance/profitability/summary').set(auth()).query(range);
    expect(res.status).toBe(200);
    const cop = res.body.currencies[0];
    expect(cop.totals.revenue).toBe('300.00');
    expect(cop.totals.cogsTheoretical).toBe('90.00');
  });
});

// ─── Grupo 4: Operational expenses (con other_costs) ────────────────────
// FIX #2: la orden debe caer DENTRO del rango de prorrateo (15-31 marzo).
// Antes estaba el 10 de marzo (fuera) → currencies[] vacío → test rompía.

describe('GET /finance/profitability/summary — operational expenses', () => {
  const range = { from: '2050-03-01', to: '2050-03-31' };

  beforeAll(async () => {
    // Orden el 20 de marzo → cae dentro del subrango 15-31 que usa el test de prorrateo
    await seedOrder({ settledAt: '2050-03-20T20:00:00-05:00', revenue: 500, tax: 40 });
    await prisma.operationalCostConfig.create({
      data: { month: '2050-03', fixedCosts: 200, variableCosts: 100, payroll: 500 },
    });
  }, 30_000);

  it('operational expenses present with hasData=true', async () => {
    const res = await request(app).get('/finance/profitability/summary').set(auth()).query(range);
    expect(res.status).toBe(200);
    const cop = res.body.currencies[0];
    expect(cop.totals.operatingExpenses.hasData).toBe(true);
    expect(cop.totals.operatingExpenses.fixedCosts).toBe('200.00');
    expect(cop.totals.operatingExpenses.variableCosts).toBe('100.00');
    expect(cop.totals.operatingExpenses.payroll).toBe('500.00');
    expect(cop.totals.operatingExpenses.total).toBe('800.00');
  });

  it('operating profit = revenue - expenses when no COGS', async () => {
    const res = await request(app).get('/finance/profitability/summary').set(auth()).query(range);
    expect(res.body.currencies[0].totals.operatingProfit).toBe('-300.00'); // 500 - 800
    expect(res.body.currencies[0].totals.operatingMarginPct).toBe('-60.00');
  });

  it('prorates partial month: 17/31 of March', async () => {
    const res = await request(app).get('/finance/profitability/summary').set(auth()).query({
      from: '2050-03-15', to: '2050-03-31',
    });
    // 17/31 de 800 = 438.71
    const total = Number(res.body.currencies[0].totals.operatingExpenses.total);
    expect(total).toBeCloseTo(438.71, 0);
  });
});

// ─── Grupo 5: Timezone + granularidad + cross-check ─────────────────────

describe('GET /finance/profitability/summary — timezone & granularity', () => {
  beforeAll(async () => {
    await seedOrder({ settledAt: '2050-06-15T23:30:00-05:00', revenue: 50, tax: 4 });
    await seedOrder({ settledAt: '2050-06-16T00:30:00-05:00', revenue: 75, tax: 6 });
  }, 30_000);

  it('timezone: 23:30 Bogota stays in same Bogota day', async () => {
    const res = await request(app).get('/finance/profitability/summary').set(auth()).query({
      from: '2050-06-15', to: '2050-06-15',
    });
    expect(res.body.currencies[0].totals.revenue).toBe('50.00');
  });

  it('timezone: 00:30 Bogota belongs to next Bogota day', async () => {
    const res = await request(app).get('/finance/profitability/summary').set(auth()).query({
      from: '2050-06-16', to: '2050-06-16',
    });
    expect(res.body.currencies[0].totals.revenue).toBe('75.00');
  });

  it('granularity=year returns one year bucket for full year range', async () => {
    const res = await request(app).get('/finance/profitability/summary').set(auth()).query({
      from: '2050-01-01', to: '2050-12-31', granularity: 'year',
    });
    const buckets = res.body.currencies[0].buckets;
    expect(buckets.map((b: { period: string }) => b.period)).toEqual(['2050']);
  });

  it('cross-check: revenue matches /finance/income for same range', async () => {
    const janRange = { from: '2050-01-01', to: '2050-01-31' };
    const [profRes, incomeRes] = await Promise.all([
      request(app).get('/finance/profitability/summary').set(auth()).query(janRange),
      request(app).get('/finance/income/summary').set(auth()).query(janRange),
    ]);
    const profTotal = profRes.body.currencies.reduce(
      (s: number, c: { totals: { revenue: string } }) => s + Number(c.totals.revenue), 0,
    );
    const incomeTotal = incomeRes.body.currencies.reduce(
      (s: number, c: { totals: { salesAmount: string } }) => s + Number(c.totals.salesAmount), 0,
    );
    expect(profTotal).toBeCloseTo(incomeTotal, 2);
    expect(profTotal).toBe(300);
  });
});