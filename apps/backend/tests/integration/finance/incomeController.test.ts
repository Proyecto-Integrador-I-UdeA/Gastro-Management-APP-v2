import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import app from '../../../src/app';

const prisma = new PrismaClient();
const RUN_ID = Date.now();
const TEST_PREFIX = `income-it-${RUN_ID}`;
const TEST_PASSWORD = 'TestIncome1234!';
const TEST_EMAIL = `${TEST_PREFIX}@test.local`;

let authToken: string;
let testUserId: number;
let testTableId: number;
let testRegisterId: number;
let testSessionId: number;

async function login(): Promise<string> {
  const res = await request(app).post('/auth/login').send({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (res.status !== 200 || !res.body?.token) {
    throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token;
}

async function seedOrder(opts: {
  settledAt: string;
  salesAmount: number;
  taxAmount: number;
  serviceAmount: number;
  serviceAccepted: boolean;
}) {
  const subtotal = opts.salesAmount + opts.taxAmount;
  const total = subtotal + opts.serviceAmount;
  const servicePercent = opts.serviceAccepted ? 10 : 0;
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
  const invoice = await prisma.salesPreInvoice.create({
    data: {
      salesOrderId: order.id,
      subtotalSnapshot: subtotal,
      salesAmountSnapshot: opts.salesAmount,
      consumptionTaxAmountSnapshot: opts.taxAmount,
      suggestedServicePercentSnapshot: 10,
      serviceAccepted: opts.serviceAccepted,
      servicePercentSnapshot: servicePercent,
      serviceAmountSnapshot: opts.serviceAmount,
      totalSnapshot: total,
      status: 'ACTIVE',
      generatedById: testUserId,
    },
  });
  return { order, invoice };
}

async function seedPayment(opts: {
  invoiceId: number;
  method: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
  amount: number;
  salesAmount: number;
  taxAmount: number;
  serviceAmount: number;
  receivedAt: string;
  suffix: string;
}) {
  return prisma.cashPayment.create({
    data: {
      preInvoiceId: opts.invoiceId,
      cashSessionId: testSessionId,
      method: opts.method,
      amount: opts.amount,
      salesAmount: opts.salesAmount,
      consumptionTaxAmount: opts.taxAmount,
      serviceAmount: opts.serviceAmount,
      amountTendered: opts.method === 'CASH' ? Math.ceil(opts.amount) : null,
      change: opts.method === 'CASH' ? Math.ceil(opts.amount) - opts.amount : 0,
      idempotencyKey: `${TEST_PREFIX}-${opts.suffix}`,
      receivedById: testUserId,
      receivedAt: new Date(opts.receivedAt),
    },
  });
}

beforeAll(async () => {
  const superRole = await prisma.role.findFirstOrThrow({ where: { name: 'super' } });
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
      fullName: `Income IT ${RUN_ID}`,
      roleId: superRole.id,
      active: true,
    },
  });
  testUserId = user.id;

  const table = await prisma.diningTable.create({
    data: { code: `IT-${RUN_ID}-T1`, capacity: 4, active: true },
  });
  testTableId = table.id;

  const register = await prisma.cashRegister.create({
    data: { name: `IT-${RUN_ID}-REG`, active: true },
  });
  testRegisterId = register.id;

  const session = await prisma.cashSession.create({
    data: {
      cashRegisterId: register.id,
      openedById: testUserId,
      status: 'OPEN',
      openingCash: 0,
    },
  });
  testSessionId = session.id;

  authToken = await login();
}, 30_000);

afterAll(async () => {
  try {
    await prisma.cashPayment.deleteMany({ where: { idempotencyKey: { startsWith: TEST_PREFIX } } });
    await prisma.salesPreInvoice.deleteMany({ where: { salesOrder: { openedBy: { email: TEST_EMAIL } } } });
    await prisma.salesOrder.deleteMany({ where: { openedBy: { email: TEST_EMAIL } } });
    await prisma.cashSession.deleteMany({ where: { id: testSessionId } });
    await prisma.cashRegister.deleteMany({ where: { id: testRegisterId } });
    await prisma.diningTable.deleteMany({ where: { id: testTableId } });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  } finally {
    await prisma.$disconnect();
  }
}, 30_000);

const auth = () => ({ Authorization: `Bearer ${authToken}` });

describe('GET /finance/income/summary — auth & validation', () => {
  const EMPTY_RANGE = { from: '2040-01-01', to: '2040-01-31' };

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/finance/income/summary').query(EMPTY_RANGE);
    expect(res.status).toBe(401);
  });

  it('returns 400 when from > to', async () => {
    const res = await request(app).get('/finance/income/summary').set(auth()).query({
      from: '2050-01-31',
      to: '2050-01-01',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when range exceeds 3 years', async () => {
    const res = await request(app).get('/finance/income/summary').set(auth()).query({
      from: '2040-01-01',
      to: '2050-01-01',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid date format', async () => {
    const res = await request(app).get('/finance/income/summary').set(auth()).query({
      from: 'not-a-date',
      to: '2050-01-31',
    });
    expect(res.status).toBe(400);
  });

  it('returns empty currencies when no data exists in the range', async () => {
    const res = await request(app).get('/finance/income/summary').set(auth()).query(EMPTY_RANGE);
    expect(res.status).toBe(200);
    expect(res.body.currencies).toEqual([]);
    expect(res.body.period.recognition).toBe('accrual');
    expect(res.body.period.granularity).toBe('month');
    expect(res.body.period.includeService).toBe(false);
  });
});

describe('GET /finance/income/summary — with data', () => {
  const janRange = { from: '2050-01-01', to: '2050-01-31' };

  beforeAll(async () => {
    const a = await seedOrder({
      settledAt: '2050-01-05T20:00:00-05:00',
      salesAmount: 100, taxAmount: 8, serviceAmount: 10.80, serviceAccepted: true,
    });
    await seedPayment({
      invoiceId: a.invoice.id, method: 'CASH',
      amount: 118.80, salesAmount: 100, taxAmount: 8, serviceAmount: 10.80,
      receivedAt: '2050-01-05T20:05:00-05:00', suffix: 'a',
    });

    const b = await seedOrder({
      settledAt: '2050-01-15T21:00:00-05:00',
      salesAmount: 250, taxAmount: 20, serviceAmount: 0, serviceAccepted: false,
    });
    await seedPayment({
      invoiceId: b.invoice.id, method: 'CARD',
      amount: 270, salesAmount: 250, taxAmount: 20, serviceAmount: 0,
      receivedAt: '2050-01-15T21:05:00-05:00', suffix: 'b',
    });

    const c = await seedOrder({
      settledAt: '2050-01-20T13:00:00-05:00',
      salesAmount: 180, taxAmount: 14.40, serviceAmount: 19.44, serviceAccepted: true,
    });
    await seedPayment({
      invoiceId: c.invoice.id, method: 'TRANSFER',
      amount: 213.84, salesAmount: 180, taxAmount: 14.40, serviceAmount: 19.44,
      receivedAt: '2050-01-20T13:10:00-05:00', suffix: 'c',
    });

    const d = await seedOrder({
      settledAt: '2050-02-03T20:30:00-05:00',
      salesAmount: 320, taxAmount: 25.60, serviceAmount: 34.56, serviceAccepted: true,
    });
    await seedPayment({
      invoiceId: d.invoice.id, method: 'CASH',
      amount: 380.16, salesAmount: 320, taxAmount: 25.60, serviceAmount: 34.56,
      receivedAt: '2050-02-03T20:35:00-05:00', suffix: 'd',
    });

    await seedOrder({
      settledAt: '2050-06-15T23:30:00-05:00',
      salesAmount: 50, taxAmount: 4, serviceAmount: 5.40, serviceAccepted: true,
    });

    await seedOrder({
      settledAt: '2050-06-16T00:30:00-05:00',
      salesAmount: 75, taxAmount: 6, serviceAmount: 8.10, serviceAccepted: true,
    });
  }, 30_000);

  it('accrual: computes Jan totals correctly', async () => {
    const res = await request(app)
      .get('/finance/income/summary')
      .set(auth())
      .query({ ...janRange, recognition: 'accrual', granularity: 'month' });

    expect(res.status).toBe(200);
    expect(res.body.currencies).toHaveLength(1);
    const cop = res.body.currencies[0];
    expect(cop.currency).toBe('COP');
    expect(cop.totals.salesAmount).toBe('530.00');
    expect(cop.totals.consumptionTaxAmount).toBe('42.40');
    expect(cop.totals.serviceAmount).toBe('30.24');
    expect(cop.totals.totalCollected).toBe('602.64');
    expect(cop.totals.orderCount).toBe(3);
    expect(cop.totals.avgTicket).toBe('176.67');
    expect(cop.totals.operationalIncome).toBe('530.00');
  });

  it('accrual + includeService=true: operationalIncome adds service', async () => {
    const res = await request(app)
      .get('/finance/income/summary')
      .set(auth())
      .query({ ...janRange, includeService: 'true' });

    expect(res.status).toBe(200);
    const cop = res.body.currencies[0];
    expect(cop.totals.salesAmount).toBe('530.00');
    expect(cop.totals.serviceAmount).toBe('30.24');
    expect(cop.totals.operationalIncome).toBe('560.24');
    expect(res.body.period.includeService).toBe(true);
  });

  it('granularity=day: returns one bucket per day in range', async () => {
    const res = await request(app)
      .get('/finance/income/summary')
      .set(auth())
      .query({ ...janRange, granularity: 'day' });

    expect(res.status).toBe(200);
    const buckets = res.body.currencies[0].buckets;
    expect(buckets).toHaveLength(31);
    expect(buckets[0].period).toBe('2050-01-01');
    expect(buckets[30].period).toBe('2050-01-31');
    expect(buckets.find((b: any) => b.period === '2050-01-05').salesAmount).toBe('100.00');
    expect(buckets.find((b: any) => b.period === '2050-01-05').orderCount).toBe(1);
    expect(buckets.find((b: any) => b.period === '2050-01-15').salesAmount).toBe('250.00');
  });

  it('granularity=month: aggregates Jan and Feb separately', async () => {
    const res = await request(app)
      .get('/finance/income/summary')
      .set(auth())
      .query({ from: '2050-01-01', to: '2050-02-28', granularity: 'month' });

    expect(res.status).toBe(200);
    expect(res.body.currencies[0].buckets).toEqual([
      { period: '2050-01', salesAmount: '530.00', orderCount: 3 },
      { period: '2050-02', salesAmount: '320.00', orderCount: 1 },
    ]);
  });

  it('recognition=cash: aggregates by payment method', async () => {
    const res = await request(app)
      .get('/finance/income/summary')
      .set(auth())
      .query({ ...janRange, recognition: 'cash' });

    expect(res.status).toBe(200);
    const cop = res.body.currencies[0];
    expect(cop.byPaymentMethod).toBeDefined();
    expect(cop.byPaymentMethod.CASH).toBe('118.80');
    expect(cop.byPaymentMethod.CARD).toBe('270.00');
    expect(cop.byPaymentMethod.TRANSFER).toBe('213.84');
    expect(cop.byPaymentMethod.OTHER).toBe('0.00');
    expect(cop.totals.salesAmount).toBe('530.00');
    expect(cop.totals.orderCount).toBe(3);
  });

  it('accrual: byPaymentMethod is absent', async () => {
    const res = await request(app)
      .get('/finance/income/summary')
      .set(auth())
      .query({ ...janRange, recognition: 'accrual' });

    expect(res.status).toBe(200);
    expect(res.body.currencies[0].byPaymentMethod).toBeUndefined();
  });

  it('timezone: 23:30 Bogota stays in the same Bogota day', async () => {
    const res = await request(app)
      .get('/finance/income/summary')
      .set(auth())
      .query({ from: '2050-06-15', to: '2050-06-15', granularity: 'day' });

    expect(res.status).toBe(200);
    const cop = res.body.currencies[0];
    expect(cop.totals.salesAmount).toBe('50.00');
    expect(cop.totals.orderCount).toBe(1);
  });

  it('timezone: 00:30 Bogota belongs to the next Bogota day', async () => {
    const res = await request(app)
      .get('/finance/income/summary')
      .set(auth())
      .query({ from: '2050-06-16', to: '2050-06-16', granularity: 'day' });

    expect(res.status).toBe(200);
    const cop = res.body.currencies[0];
    expect(cop.totals.salesAmount).toBe('75.00');
    expect(cop.totals.orderCount).toBe(1);
  });

  it('cross-check: total salesAmount matches /sales/analytics for the same range', async () => {
    const [incomeRes, analyticsRes] = await Promise.all([
      request(app).get('/finance/income/summary').set(auth()).query(janRange),
      request(app).get('/sales/analytics').set(auth()).query({
        period: 'custom',
        from: '2050-01-01',
        to: '2050-01-31',
      }),
    ]);

    expect(incomeRes.status).toBe(200);
    expect(analyticsRes.status).toBe(200);

    const incomeTotal = incomeRes.body.currencies.reduce(
      (sum: number, c: any) => sum + Number(c.totals.salesAmount), 0,
    );
    const analyticsTotal = analyticsRes.body.currencies.reduce(
      (sum: number, c: any) => sum + Number(c.summary.salesAmount), 0,
    );
    expect(incomeTotal).toBeCloseTo(analyticsTotal, 2);
    expect(incomeTotal).toBe(530);
  });
});