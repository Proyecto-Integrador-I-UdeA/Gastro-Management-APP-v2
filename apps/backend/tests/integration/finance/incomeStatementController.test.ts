import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import app from '../../../src/app';

const prisma = new PrismaClient();
const RUN_ID = Date.now();
const TEST_PREFIX = `is-it-${RUN_ID}`;
const TEST_PASSWORD = 'TestIS1234!';
const TEST_EMAIL = `${TEST_PREFIX}@test.local`;

let authToken: string;
let testUserId: number;
let testTableId: number;
let testMenuItemId: number;
let testMenuItemPriceId: number;
let testRegisterId: number;

async function login(): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (res.status !== 200 || !res.body?.token) throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

async function seedOrder(opts: {
  settledAt: string;
  revenue: number;
  tax: number;
  /** Si se pasa, se calcula serviceAmount = subtotal * servicePercent / 100 */
  servicePercent?: number;
  serviceAccepted?: boolean;
  quantity?: number;
  baseCostUnit?: number;
  guestCount?: number;
}) {
  const subtotal = opts.revenue + opts.tax;
  const servicePercent = opts.serviceAccepted ? (opts.servicePercent ?? 10) : 0;
  const service = opts.serviceAccepted
    ? Math.round(subtotal * servicePercent) / 100 * 1  // redondeo explícito abajo
    : 0;
  // Cálculo explícito que cumple con la constraint de Postgres
  const serviceAmount = opts.serviceAccepted
    ? Number((subtotal * servicePercent / 100).toFixed(2))
    : 0;
  const total = subtotal + serviceAmount;

  const order = await prisma.salesOrder.create({
    data: {
      diningTableId: testTableId,
      status: 'SETTLED',
      openedById: testUserId,
      settledById: testUserId,
      paymentStatus: 'PAID',
      settledAt: new Date(opts.settledAt),
      openedAt: new Date(new Date(opts.settledAt).getTime() - 3_600_000),
      guestCount: opts.guestCount ?? null,
    },
  });
  await prisma.salesPreInvoice.create({
    data: {
      salesOrderId: order.id,
      subtotalSnapshot: subtotal,
      salesAmountSnapshot: opts.revenue,
      consumptionTaxAmountSnapshot: opts.tax,
      suggestedServicePercentSnapshot: opts.servicePercent ?? 10,
      serviceAccepted: opts.serviceAccepted ?? false,
      servicePercentSnapshot: servicePercent,
      serviceAmountSnapshot: serviceAmount,
      totalSnapshot: total,
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
  void service; // suprime warning de TS de variable no usada
  return order;
}

beforeAll(async () => {
  const superRole = await prisma.role.findFirstOrThrow({ where: { name: 'super' } });
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
      fullName: `IS IT ${RUN_ID}`,
      roleId: superRole.id,
      active: true,
    },
  });
  testUserId = user.id;

  const table = await prisma.diningTable.create({
    data: { code: `IS-${RUN_ID}-T`, capacity: 4, active: true },
  });
  testTableId = table.id;

  const category = await prisma.menuCategory.create({
    data: { name: `IS Cat ${RUN_ID}`, normalizedName: `is-cat-${RUN_ID}`, active: true },
  });
  const item = await prisma.menuItem.create({
    data: { name: `IS Item ${RUN_ID}`, active: true, available: true, kind: 'STANDARD', categoryId: category.id },
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

  const register = await prisma.cashRegister.create({
    data: { name: `IS-REG-${RUN_ID}`, active: true },
  });
  testRegisterId = register.id;

  authToken = await login();
}, 30_000);

afterAll(async () => {
  try {
    await prisma.cashPayment.deleteMany({ where: { receivedBy: { email: TEST_EMAIL } } });
    await prisma.salesOrderItem.deleteMany({ where: { salesOrder: { openedBy: { email: TEST_EMAIL } } } });
    await prisma.salesPreInvoice.deleteMany({ where: { salesOrder: { openedBy: { email: TEST_EMAIL } } } });
    await prisma.salesOrder.deleteMany({ where: { openedBy: { email: TEST_EMAIL } } });
    await prisma.menuItemPrice.deleteMany({ where: { id: testMenuItemPriceId } });
    await prisma.menuItem.deleteMany({ where: { id: testMenuItemId } });
    await prisma.menuCategory.deleteMany({ where: { normalizedName: `is-cat-${RUN_ID}` } });
    await prisma.diningTable.deleteMany({ where: { id: testTableId } });
    await prisma.cashSession.deleteMany({ where: { openedBy: { email: TEST_EMAIL } } });
    await prisma.cashRegister.deleteMany({ where: { id: testRegisterId } });
    await prisma.operationalCostConfig.deleteMany({ where: { month: { startsWith: '2050-' } } });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  } finally {
    await prisma.$disconnect();
  }
}, 30_000);

const auth = () => ({ Authorization: `Bearer ${authToken}` });

describe('GET /finance/income-statement/summary — auth & validation', () => {
  const EMPTY = { from: '2040-01-01', to: '2040-01-31' };

  it('returns 401 without token', async () => {
    const res = await request(app).get('/finance/income-statement/summary').query(EMPTY);
    expect(res.status).toBe(401);
  });

  it('returns 400 when from > to', async () => {
    const res = await request(app).get('/finance/income-statement/summary').set(auth()).query({
      from: '2050-01-31', to: '2050-01-01',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when range exceeds 5 years', async () => {
    const res = await request(app).get('/finance/income-statement/summary').set(auth()).query({
      from: '2040-01-01', to: '2050-01-01',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid date', async () => {
    const res = await request(app).get('/finance/income-statement/summary').set(auth()).query({
      from: 'not-a-date', to: '2050-01-31',
    });
    expect(res.status).toBe(400);
  });

  it('returns empty currencies when no data', async () => {
    const res = await request(app).get('/finance/income-statement/summary').set(auth()).query(EMPTY);
    expect(res.status).toBe(200);
    expect(res.body.currencies).toEqual([]);
  });
});

describe('GET /finance/income-statement/summary — P&L básico', () => {
  const range = { from: '2050-01-01', to: '2050-01-31' };

  beforeAll(async () => {
    // Orden 1: revenue 500, tax 40, subtotal 540, service 54 (10%), total 594
    await seedOrder({
      settledAt: '2050-01-10T20:00:00-05:00',
      revenue: 500, tax: 40,
      serviceAccepted: true, servicePercent: 10,
      quantity: 1, baseCostUnit: 30,
      guestCount: 3,
    });
    // Orden 2: revenue 300, tax 24, sin servicio, total 324
    await seedOrder({
      settledAt: '2050-01-20T20:00:00-05:00',
      revenue: 300, tax: 24,
      quantity: 2, baseCostUnit: 30,
      guestCount: 2,
    });
  }, 30_000);

  it('revenue.total = sales + service (D1=A)', async () => {
    const res = await request(app).get('/finance/income-statement/summary').set(auth()).query(range);
    expect(res.status).toBe(200);
    const cop = res.body.currencies[0];
    expect(cop.pnl.revenue.sales).toBe('800.00');
    expect(cop.pnl.revenue.service).toBe('54.00');
    expect(cop.pnl.revenue.total).toBe('854.00');
    expect(cop.pnl.revenue.consumptionTax).toBe('64.00');
  });

  it('grossProfit = revenue.total - cogs.real', async () => {
    const res = await request(app).get('/finance/income-statement/summary').set(auth()).query(range);
    const cop = res.body.currencies[0];
    expect(cop.pnl.grossProfit).toBe('854.00'); // 854 - 0 (sin consumos)
  });

  it('KPIs de márgenes: grossMargin, operatingMargin, foodCost, primeCost', async () => {
    const res = await request(app).get('/finance/income-statement/summary').set(auth()).query(range);
    const m = res.body.currencies[0].kpis.margins;
    expect(m.grossMarginPct).toBe('100.00');
    expect(m.operatingMarginPct).toBe('100.00');
    expect(m.foodCostPct).toBe('0.00');
    expect(m.primeCostPct).toBe('0.00');
  });

  it('KPIs de volumen: orderCount, avgTicket, guests', async () => {
    const res = await request(app).get('/finance/income-statement/summary').set(auth()).query(range);
    const v = res.body.currencies[0].kpis.volume;
    expect(v.orderCount).toBe(2);
    expect(v.avgTicket).toBe('427.00'); // 854 / 2
    expect(v.hasGuestData).toBe(true);
    expect(v.totalGuests).toBe(5);
    expect(v.avgGuestsPerOrder).toBe('2.50');
    expect(v.revenuePerGuest).toBe('170.80'); // 854 / 5
  });

  it('hasData = false cuando no hay other_costs', async () => {
    const res = await request(app).get('/finance/income-statement/summary').set(auth()).query(range);
    expect(res.body.currencies[0].pnl.operatingExpenses.hasData).toBe(false);
    expect(res.body.currencies[0].pnl.operatingProfit).toBe('854.00');
  });
});

describe('GET /finance/income-statement/summary — con gastos operativos', () => {
  const range = { from: '2050-03-01', to: '2050-03-31' };

  beforeAll(async () => {
    await seedOrder({ settledAt: '2050-03-20T20:00:00-05:00', revenue: 1000, tax: 0 });
    await prisma.operationalCostConfig.create({
      data: { month: '2050-03', fixedCosts: 200, variableCosts: 100, payroll: 300 },
    });
  }, 30_000);

  it('operatingProfit = grossProfit - operatingExpenses.total', async () => {
    const res = await request(app).get('/finance/income-statement/summary').set(auth()).query(range);
    const p = res.body.currencies[0].pnl;
    expect(p.operatingExpenses.fixed).toBe('200.00');
    expect(p.operatingExpenses.variable).toBe('100.00');
    expect(p.operatingExpenses.payroll).toBe('300.00');
    expect(p.operatingExpenses.total).toBe('600.00');
    expect(p.operatingExpenses.hasData).toBe(true);
    expect(p.operatingProfit).toBe('400.00');
  });

  it('laborCostPct = payroll / revenue', async () => {
    const res = await request(app).get('/finance/income-statement/summary').set(auth()).query(range);
    expect(res.body.currencies[0].kpis.costStructure.laborCostPct).toBe('30.00');
  });

  it('prorratea parcial: 15-31 de marzo = 17/31 de 600 = 329.03', async () => {
    const res = await request(app).get('/finance/income-statement/summary').set(auth()).query({
      from: '2050-03-15', to: '2050-03-31',
    });
    const total = Number(res.body.currencies[0].pnl.operatingExpenses.total);
    expect(total).toBeCloseTo(329.03, 0);
  });
});

describe('GET /finance/income-statement/summary — timezone & granularidad', () => {
  beforeAll(async () => {
    await seedOrder({ settledAt: '2050-06-15T23:30:00-05:00', revenue: 100, tax: 0 });
    await seedOrder({ settledAt: '2050-06-16T00:30:00-05:00', revenue: 200, tax: 0 });
  }, 30_000);

  it('timezone: 23:30 Bogotá queda en el 15', async () => {
    const res = await request(app).get('/finance/income-statement/summary').set(auth()).query({
      from: '2050-06-15', to: '2050-06-15',
    });
    expect(res.body.currencies[0].pnl.revenue.total).toBe('100.00');
  });

  it('timezone: 00:30 Bogotá queda en el 16', async () => {
    const res = await request(app).get('/finance/income-statement/summary').set(auth()).query({
      from: '2050-06-16', to: '2050-06-16',
    });
    expect(res.body.currencies[0].pnl.revenue.total).toBe('200.00');
  });

  it('granularity=year: agrupa en año', async () => {
    const res = await request(app).get('/finance/income-statement/summary').set(auth()).query({
      from: '2050-01-01', to: '2050-12-31', granularity: 'year',
    });
    expect(res.body.currencies[0].buckets.map((b: { period: string }) => b.period)).toEqual(['2050']);
  });

  it('cross-check: revenue.total coincide con /finance/income (sales + service)', async () => {
    const janRange = { from: '2050-01-01', to: '2050-01-31' };
    const [isRes, incRes] = await Promise.all([
      request(app).get('/finance/income-statement/summary').set(auth()).query(janRange),
      request(app).get('/finance/income/summary').set(auth()).query({
        ...janRange, recognition: 'accrual', granularity: 'month', includeService: 'true',
      }),
    ]);
    const isTotal = isRes.body.currencies.reduce(
      (s: number, c: { pnl: { revenue: { total: string } } }) => s + Number(c.pnl.revenue.total), 0,
    );
    const incTotal = incRes.body.currencies.reduce(
      (s: number, c: { totals: { operationalIncome: string } }) => s + Number(c.totals.operationalIncome), 0,
    );
    expect(isTotal).toBeCloseTo(incTotal, 2);
  });
});