import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import app from '../../../src/app';

const prisma = new PrismaClient();
const RUN_ID = Date.now();
const TEST_EMAIL = `dash-it-${RUN_ID}@test.local`;
const TEST_PASSWORD = 'TestDash1234!';

let authToken: string;
let testUserId: number;
let cajaId: number;
let bancoId: number;
let tableId: number;
const payablesIds: number[] = [];
const counterpartiesIds: number[] = [];

async function login(): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (res.status !== 200 || !res.body?.token) throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

async function seedOrder(opts: {
  settledAt: string;
  revenue: number;
  tax?: number;
}) {
  const tax = opts.tax ?? 0;
  const subtotal = opts.revenue + tax;
  const order = await prisma.salesOrder.create({
    data: {
      diningTableId: tableId,
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
      consumptionTaxAmountSnapshot: tax,
      suggestedServicePercentSnapshot: 0,
      serviceAccepted: false,
      servicePercentSnapshot: 0,
      serviceAmountSnapshot: 0,
      totalSnapshot: subtotal,
      status: 'ACTIVE',
      generatedById: testUserId,
    },
  });
  return order;
}

beforeAll(async () => {
  // Reset de saldos de TODOS los medios activos (evita contaminación entre suites)
  await prisma.financePaymentMethod.updateMany({
    where: { active: true },
    data: { currentBalance: 0 },
  });

  const superRole = await prisma.role.findFirstOrThrow({ where: { name: 'super' } });
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
      fullName: `Dash IT ${RUN_ID}`,
      roleId: superRole.id,
      active: true,
    },
  });
  testUserId = user.id;

  const table = await prisma.diningTable.create({
    data: { code: `DASH-${RUN_ID}`, capacity: 4, active: true },
  });
  tableId = table.id;

  const caja = await prisma.financePaymentMethod.create({
    data: { name: `DASH-Caja-${RUN_ID}`, kind: 'CASH', currency: 'COP', currentBalance: 1000, active: true },
  });
  cajaId = caja.id;

  const banco = await prisma.financePaymentMethod.create({
    data: { name: `DASH-Banco-${RUN_ID}`, kind: 'BANK', currency: 'COP', currentBalance: 500, active: true },
  });
  bancoId = banco.id;

  // Counterparty para los payables
  const cp = await prisma.financeCounterparty.create({
    data: { name: `DASH-Supplier-${RUN_ID}`, kind: 'SUPPLIER', active: true },
  });
  counterpartiesIds.push(cp.id);

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const in30d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // 1) OPEN dentro de 7d → SÍ cuenta (200)
  const p1 = await prisma.financePayable.create({
    data: {
      concept: `DASH-CxP-cercana-${RUN_ID}`,
      amount: 200,
      currency: 'COP',
      dueDate: tomorrow,
      status: 'OPEN',
      counterpartyId: cp.id,
      createdById: testUserId,
    },
  });
  payablesIds.push(p1.id);

  // 2) OPEN fuera de 7d (30 días) → NO cuenta (999)
  const p2 = await prisma.financePayable.create({
    data: {
      concept: `DASH-CxP-lejana-${RUN_ID}`,
      amount: 999,
      currency: 'COP',
      dueDate: in30d,
      status: 'OPEN',
      counterpartyId: cp.id,
      createdById: testUserId,
    },
  });
  payablesIds.push(p2.id);

  // 3) PAID dentro de 7d → NO cuenta (500)
  const p3 = await prisma.financePayable.create({
    data: {
      concept: `DASH-CxP-pagada-${RUN_ID}`,
      amount: 500,
      currency: 'COP',
      dueDate: tomorrow,
      status: 'PAID',
      counterpartyId: cp.id,
      createdById: testUserId,
      paidAt: new Date(),
    },
  });
  payablesIds.push(p3.id);

  authToken = await login();
}, 30_000);

afterAll(async () => {
  try {
    await prisma.salesPreInvoice.deleteMany({ where: { salesOrder: { openedBy: { email: TEST_EMAIL } } } });
    await prisma.salesOrder.deleteMany({ where: { openedBy: { email: TEST_EMAIL } } });
    await prisma.financePayable.deleteMany({ where: { id: { in: payablesIds } } });
    await prisma.financeCounterparty.deleteMany({ where: { id: { in: counterpartiesIds } } });
    await prisma.financePaymentMethod.deleteMany({ where: { id: { in: [cajaId, bancoId] } } });
    await prisma.diningTable.deleteMany({ where: { id: tableId } });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  } finally {
    await prisma.$disconnect();
  }
}, 30_000);

const auth = () => ({ Authorization: `Bearer ${authToken}` });

// ─── Auth & validación ────────────────────────────────────────────────────

describe('GET /finance/dashboard/summary — auth & validation', () => {
  const EMPTY = { from: '2040-01-01', to: '2040-01-31' };

  it('401 sin token', async () => {
    const res = await request(app).get('/finance/dashboard/summary').query(EMPTY);
    expect(res.status).toBe(401);
  });

  it('400 si from > to', async () => {
    const res = await request(app).get('/finance/dashboard/summary').set(auth()).query({
      from: '2050-01-31',
      to: '2050-01-01',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('400 si rango > 3 años', async () => {
    const res = await request(app).get('/finance/dashboard/summary').set(auth()).query({
      from: '2040-01-01',
      to: '2050-01-01',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

// ─── Liquidez (independiente del período) ────────────────────────────────

describe('GET /finance/dashboard/summary — liquidez', () => {
  it('liquidez se calcula incluso con rango vacío', async () => {
    const res = await request(app).get('/finance/dashboard/summary').set(auth()).query({
      from: '2040-01-01',
      to: '2040-01-31',
    });
    expect(res.status).toBe(200);
    expect(res.body.hasIncomeData).toBe(false);
    expect(res.body.liquidity.availableBalance).toBe('1500.00'); // 1000 + 500
    expect(res.body.liquidity.next7DaysPayables).toBe('200.00'); // solo OPEN dentro de 7d
    expect(res.body.liquidity.hasPayables).toBe(true);
    expect(res.body.liquidity.payablesCount).toBe(1);
    expect(res.body.liquidity.coverageRatio).toBe('7.50'); // 1500/200
  });

  it('paymentMethods incluye los 2 medios del test', async () => {
    const res = await request(app).get('/finance/dashboard/summary').set(auth()).query({
      from: '2040-01-01',
      to: '2040-01-31',
    });
    const ids = res.body.liquidity.paymentMethods.map((m: { id: number }) => m.id);
    expect(ids).toContain(cajaId);
    expect(ids).toContain(bancoId);
  });

  it('CxP fuera de 7d (OPEN) NO cuenta', async () => {
    const res = await request(app).get('/finance/dashboard/summary').set(auth()).query({
      from: '2040-01-01',
      to: '2040-01-31',
    });
    // Si contara la lejana (999), next7DaysPayables sería 1199
    expect(res.body.liquidity.next7DaysPayables).not.toBe('1199.00');
    expect(res.body.liquidity.next7DaysPayables).toBe('200.00');
  });

  it('CxP PAID dentro de 7d NO cuenta', async () => {
    const res = await request(app).get('/finance/dashboard/summary').set(auth()).query({
      from: '2040-01-01',
      to: '2040-01-31',
    });
    // Si contara la PAID (500), next7DaysPayables sería 700
    expect(res.body.liquidity.next7DaysPayables).not.toBe('700.00');
    expect(res.body.liquidity.payablesCount).toBe(1);
  });

  it('rango vacío → profitability y efficiency en 0', async () => {
    const res = await request(app).get('/finance/dashboard/summary').set(auth()).query({
      from: '2040-01-01',
      to: '2040-01-31',
    });
    expect(res.body.profitability.revenue).toBe('0.00');
    expect(res.body.profitability.grossMarginPct).toBe('0.00');
    expect(res.body.efficiency.avgTicket).toBe('0.00');
    expect(res.body.efficiency.foodCostPct).toBe('0.00');
    expect(res.body.efficiency.fixedCostRatioPct).toBe('0.00');
  });
});

// ─── Con datos del período ───────────────────────────────────────────────

describe('GET /finance/dashboard/summary — con datos del período', () => {
  const range = { from: '2050-01-01', to: '2050-01-31' };

  beforeAll(async () => {
    await seedOrder({ settledAt: '2050-01-10T20:00:00-05:00', revenue: 100, tax: 8 });
    await seedOrder({ settledAt: '2050-01-20T20:00:00-05:00', revenue: 400, tax: 32 });
  }, 30_000);

  it('hasIncomeData=true y profitability coincide', async () => {
    const res = await request(app).get('/finance/dashboard/summary').set(auth()).query(range);
    expect(res.status).toBe(200);
    expect(res.body.hasIncomeData).toBe(true);
    expect(res.body.profitability.revenue).toBe('500.00');
    expect(res.body.profitability.grossProfit).toBe('500.00'); // sin COGS
    expect(res.body.profitability.grossMarginPct).toBe('100.00');
    expect(res.body.profitability.operatingProfit).toBe('500.00');
  });

  it('efficiency: avgTicket = revenue / orderCount', async () => {
    const res = await request(app).get('/finance/dashboard/summary').set(auth()).query(range);
    expect(res.body.efficiency.avgTicket).toBe('250.00'); // 500/2
    expect(res.body.efficiency.foodCostPct).toBe('0.00'); // sin COGS
    expect(res.body.efficiency.fixedCostRatioPct).toBe('0.00'); // sin gastos fijos
  });

  it('liquidez se mantiene igual con datos del período', async () => {
    const res = await request(app).get('/finance/dashboard/summary').set(auth()).query(range);
    expect(res.body.liquidity.availableBalance).toBe('1500.00');
    expect(res.body.liquidity.coverageRatio).toBe('7.50');
  });

  it('multiCurrencyDetected=false con un solo currency', async () => {
    const res = await request(app).get('/finance/dashboard/summary').set(auth()).query(range);
    expect(res.body.multiCurrencyDetected).toBe(false);
    expect(res.body.currency).toBe('COP');
  });

  it('period refleja el query original', async () => {
    const res = await request(app).get('/finance/dashboard/summary').set(auth()).query(range);
    expect(res.body.period).toEqual({ from: '2050-01-01', to: '2050-01-31' });
  });
});

// ─── Cross-check con /income-statement ───────────────────────────────────

describe('Cross-check: /finance/dashboard vs /finance/income-statement', () => {
  const range = { from: '2050-01-01', to: '2050-01-31' };

  it('profitability.revenue coincide exactamente', async () => {
    const [dashRes, isRes] = await Promise.all([
      request(app).get('/finance/dashboard/summary').set(auth()).query(range),
      request(app).get('/finance/income-statement/summary').set(auth()).query({
        ...range,
        granularity: 'month',
      }),
    ]);

    expect(dashRes.status).toBe(200);
    expect(isRes.status).toBe(200);

    const dashRevenue = Number(dashRes.body.profitability.revenue);
    const isRevenue = isRes.body.currencies.reduce(
      (s: number, c: { pnl: { revenue: { total: string } } }) => s + Number(c.pnl.revenue.total),
      0,
    );
    expect(dashRevenue).toBeCloseTo(isRevenue, 2);
    expect(dashRevenue).toBe(500);
  });

  it('márgenes, food cost y ticket coinciden', async () => {
    const [dashRes, isRes] = await Promise.all([
      request(app).get('/finance/dashboard/summary').set(auth()).query(range),
      request(app).get('/finance/income-statement/summary').set(auth()).query({
        ...range,
        granularity: 'month',
      }),
    ]);
    const isCop = isRes.body.currencies.find((c: { currency: string }) => c.currency === 'COP');
    expect(isCop).toBeDefined();
    expect(dashRes.body.profitability.grossMarginPct).toBe(isCop.kpis.margins.grossMarginPct);
    expect(dashRes.body.profitability.operatingMarginPct).toBe(isCop.kpis.margins.operatingMarginPct);
    expect(dashRes.body.efficiency.foodCostPct).toBe(isCop.kpis.margins.foodCostPct);
    expect(dashRes.body.efficiency.avgTicket).toBe(isCop.kpis.volume.avgTicket);
  });
});