import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import app from '../../../src/app';

const prisma = new PrismaClient();
const RUN_ID = Date.now();
const TEST_PREFIX = `tr-it-${RUN_ID}`;
const TEST_PASSWORD = 'TestTR1234!';
const TEST_EMAIL = `${TEST_PREFIX}@test.local`;

let authToken: string;
let testUserId: number;
let cashMethodId: number;
let bankMethodId: number;
let gatewayMethodId: number;
let usdMethodId: number;

async function login(): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (res.status !== 200 || !res.body?.token) throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

async function getBalance(id: number): Promise<string> {
  const m = await prisma.financePaymentMethod.findUniqueOrThrow({
    where: { id },
    select: { currentBalance: true },
  });
  return m.currentBalance.toFixed(2);
}

async function setBalance(id: number, value: number): Promise<void> {
  await prisma.financePaymentMethod.update({
    where: { id },
    data: { currentBalance: value },
  });
}

beforeAll(async () => {
  const superRole = await prisma.role.findFirstOrThrow({ where: { name: 'super' } });
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
      fullName: `TR IT ${RUN_ID}`,
      roleId: superRole.id,
      active: true,
    },
  });
  testUserId = user.id;

  const cash = await prisma.financePaymentMethod.create({
    data: { name: `IT-CASH-${RUN_ID}`, kind: 'CASH', currency: 'COP', currentBalance: 1000 },
  });
  cashMethodId = cash.id;

  const bank = await prisma.financePaymentMethod.create({
    data: { name: `IT-BANK-${RUN_ID}`, kind: 'BANK', currency: 'COP', currentBalance: 500 },
  });
  bankMethodId = bank.id;

  const gateway = await prisma.financePaymentMethod.create({
    data: { name: `IT-GW-${RUN_ID}`, kind: 'GATEWAY', currency: 'COP', currentBalance: 0 },
  });
  gatewayMethodId = gateway.id;

  const usd = await prisma.financePaymentMethod.create({
    data: { name: `IT-USD-${RUN_ID}`, kind: 'BANK', currency: 'USD', currentBalance: 100 },
  });
  usdMethodId = usd.id;

  authToken = await login();
}, 30_000);

beforeEach(async () => {
  // Reset saldos a valores base
  await setBalance(cashMethodId, 1000);
  await setBalance(bankMethodId, 500);
  await setBalance(gatewayMethodId, 0);
  await setBalance(usdMethodId, 100);
  // Borrar transfers del usuario de test
  await prisma.financeTransfer.deleteMany({ where: { createdById: testUserId } });
}, 10_000);

afterAll(async () => {
  try {
    await prisma.financeTransfer.deleteMany({ where: { createdById: testUserId } });
    await prisma.financePaymentMethod.deleteMany({
      where: { id: { in: [cashMethodId, bankMethodId, gatewayMethodId, usdMethodId] } },
    });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  } finally {
    await prisma.$disconnect();
  }
}, 30_000);

const auth = () => ({ Authorization: `Bearer ${authToken}` });

// ─── Auth & validación ────────────────────────────────────────────────────

describe('POST /finance/transfers — auth & validation', () => {
  it('401 sin token', async () => {
    const res = await request(app).post('/finance/transfers').send({});
    expect(res.status).toBe(401);
  });

  it('400 si source === target', async () => {
    const res = await request(app).post('/finance/transfers').set(auth()).send({
      occurredAt: '2026-03-15',
      sourceMethodId: cashMethodId,
      targetMethodId: cashMethodId,
      amount: '100.00',
      description: 'Mismo medio',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('400 si amount ≤ 0', async () => {
    const res = await request(app).post('/finance/transfers').set(auth()).send({
      occurredAt: '2026-03-15',
      sourceMethodId: cashMethodId,
      targetMethodId: bankMethodId,
      amount: '0',
      description: 'Cero',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('400 si falta descripción', async () => {
    const res = await request(app).post('/finance/transfers').set(auth()).send({
      occurredAt: '2026-03-15',
      sourceMethodId: cashMethodId,
      targetMethodId: bankMethodId,
      amount: '100.00',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('400 si monedas distintas (COP → USD)', async () => {
    const res = await request(app).post('/finance/transfers').set(auth()).send({
      occurredAt: '2026-03-15',
      sourceMethodId: cashMethodId,
      targetMethodId: usdMethodId,
      amount: '100.00',
      description: 'COP a USD',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TRANSFER_CURRENCY_MISMATCH');
  });

  it('404 si source inexistente', async () => {
    const res = await request(app).post('/finance/transfers').set(auth()).send({
      occurredAt: '2026-03-15',
      sourceMethodId: 999999,
      targetMethodId: bankMethodId,
      amount: '100.00',
      description: 'Source inexistente',
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TRANSFER_SOURCE_NOT_FOUND');
  });

  it('404 si target inexistente', async () => {
    const res = await request(app).post('/finance/transfers').set(auth()).send({
      occurredAt: '2026-03-15',
      sourceMethodId: cashMethodId,
      targetMethodId: 999999,
      amount: '100.00',
      description: 'Target inexistente',
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TRANSFER_TARGET_NOT_FOUND');
  });
});

// ─── Happy path ──────────────────────────────────────────────────────────

describe('POST /finance/transfers — happy path', () => {
  it('crea transferencia y actualiza saldos atómicamente', async () => {
    const beforeCash = await getBalance(cashMethodId);
    const beforeBank = await getBalance(bankMethodId);
    expect(beforeCash).toBe('1000.00');
    expect(beforeBank).toBe('500.00');

    const res = await request(app).post('/finance/transfers').set(auth()).send({
      occurredAt: '2026-03-15',
      sourceMethodId: cashMethodId,
      targetMethodId: bankMethodId,
      amount: '300.00',
      description: 'Traslado a banco',
      documentNumber: 'TRF-001',
    });

    expect(res.status).toBe(201);
    expect(res.body.amount).toBe('300.00');
    expect(res.body.currency).toBe('COP');
    expect(res.body.sourceMethod.id).toBe(cashMethodId);
    expect(res.body.sourceMethod.currentBalance).toBe('700.00');
    expect(res.body.targetMethod.id).toBe(bankMethodId);
    expect(res.body.targetMethod.currentBalance).toBe('800.00');
    expect(res.body.documentNumber).toBe('TRF-001');

    // Verificar en BD
    expect(await getBalance(cashMethodId)).toBe('700.00');
    expect(await getBalance(bankMethodId)).toBe('800.00');
  });

  it('permite saldo resultante exactamente 0 en origen', async () => {
    // Banco tiene 500, transferir 500 exactos → 0
    const res = await request(app).post('/finance/transfers').set(auth()).send({
      occurredAt: '2026-03-15',
      sourceMethodId: bankMethodId,
      targetMethodId: gatewayMethodId,
      amount: '500.00',
      description: 'Vaciar banco',
    });
    expect(res.status).toBe(201);
    expect(await getBalance(bankMethodId)).toBe('0.00');
    expect(await getBalance(gatewayMethodId)).toBe('500.00');
  });

  it('varias transferencias seguidas se acumulan correctamente', async () => {
    // 3 transferencias: 100, 200, 300 de Caja a Banco
    for (const amount of ['100.00', '200.00', '300.00']) {
      const res = await request(app).post('/finance/transfers').set(auth()).send({
        occurredAt: '2026-03-15',
        sourceMethodId: cashMethodId,
        targetMethodId: bankMethodId,
        amount,
        description: `Transferencia ${amount}`,
      });
      expect(res.status).toBe(201);
    }
    expect(await getBalance(cashMethodId)).toBe('400.00'); // 1000 - 600
    expect(await getBalance(bankMethodId)).toBe('1100.00'); // 500 + 600
  });
});

// ─── Atomicidad / rollback ────────────────────────────────────────────────

describe('POST /finance/transfers — atomicidad', () => {
  it('saldo insuficiente → 409 y NADA se modifica (rollback)', async () => {
    const beforeCash = await getBalance(cashMethodId);
    const beforeBank = await getBalance(bankMethodId);
    const beforeCount = await prisma.financeTransfer.count({ where: { createdById: testUserId } });

    const res = await request(app).post('/finance/transfers').set(auth()).send({
      occurredAt: '2026-03-15',
      sourceMethodId: cashMethodId,
      targetMethodId: bankMethodId,
      amount: '5000.00',
      description: 'Transferencia imposible',
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TRANSFER_INSUFFICIENT_BALANCE');
    expect(res.body.available).toBe('1000.00');
    expect(res.body.requested).toBe('5000.00');
    expect(res.body.shortfall).toBe('4000.00');

    // Verificar rollback completo
    expect(await getBalance(cashMethodId)).toBe(beforeCash);
    expect(await getBalance(bankMethodId)).toBe(beforeBank);
    expect(await prisma.financeTransfer.count({ where: { createdById: testUserId } })).toBe(beforeCount);
  });

  it('fallo en moneda distinta → 400 y NADA se modifica (rollback)', async () => {
    const beforeCash = await getBalance(cashMethodId);
    const beforeUsd = await getBalance(usdMethodId);

    const res = await request(app).post('/finance/transfers').set(auth()).send({
      occurredAt: '2026-03-15',
      sourceMethodId: cashMethodId,
      targetMethodId: usdMethodId,
      amount: '100.00',
      description: 'COP a USD',
    });

    expect(res.status).toBe(400);
    expect(await getBalance(cashMethodId)).toBe(beforeCash);
    expect(await getBalance(usdMethodId)).toBe(beforeUsd);
  });
});

// ─── List & search ────────────────────────────────────────────────────────

describe('GET /finance/transfers — list & search', () => {
  it('devuelve array vacío cuando no hay transferencias', async () => {
    const res = await request(app).get('/finance/transfers').set(auth()).query({
      from: '2026-03-01',
      to: '2026-03-31',
    });
    expect(res.status).toBe(200);
    expect(res.body.transfers).toEqual([]);
  });

  it('lista transferencias del rango', async () => {
    // Crear 2 transferencias
    await request(app).post('/finance/transfers').set(auth()).send({
      occurredAt: '2026-03-10',
      sourceMethodId: cashMethodId,
      targetMethodId: bankMethodId,
      amount: '100.00',
      description: 'Marzo 10',
    });
    await request(app).post('/finance/transfers').set(auth()).send({
      occurredAt: '2026-03-20',
      sourceMethodId: cashMethodId,
      targetMethodId: bankMethodId,
      amount: '200.00',
      description: 'Marzo 20',
    });

    const res = await request(app).get('/finance/transfers').set(auth()).query({
      from: '2026-03-01',
      to: '2026-03-31',
    });
    expect(res.status).toBe(200);
    expect(res.body.transfers.length).toBe(2);
  });

  it('filtra por rango que excluye transferencias', async () => {
    await request(app).post('/finance/transfers').set(auth()).send({
      occurredAt: '2026-03-10',
      sourceMethodId: cashMethodId,
      targetMethodId: bankMethodId,
      amount: '100.00',
      description: 'Marzo 10',
    });

    const res = await request(app).get('/finance/transfers').set(auth()).query({
      from: '2026-04-01',
      to: '2026-04-30',
    });
    expect(res.status).toBe(200);
    expect(res.body.transfers).toEqual([]);
  });

  it('busca por descripción', async () => {
    await request(app).post('/finance/transfers').set(auth()).send({
      occurredAt: '2026-03-10',
      sourceMethodId: cashMethodId,
      targetMethodId: bankMethodId,
      amount: '100.00',
      description: 'Pago tarjeta corporativa',
    });
    await request(app).post('/finance/transfers').set(auth()).send({
      occurredAt: '2026-03-20',
      sourceMethodId: cashMethodId,
      targetMethodId: bankMethodId,
      amount: '200.00',
      description: 'Traslado a banco',
    });

    const res = await request(app).get('/finance/transfers').set(auth()).query({
      from: '2026-03-01',
      to: '2026-03-31',
      search: 'tarjeta',
    });
    expect(res.status).toBe(200);
    expect(res.body.transfers.length).toBe(1);
    expect(res.body.transfers[0].description).toContain('tarjeta');
  });

  it('busca por número de documento', async () => {
    await request(app).post('/finance/transfers').set(auth()).send({
      occurredAt: '2026-03-10',
      sourceMethodId: cashMethodId,
      targetMethodId: bankMethodId,
      amount: '100.00',
      description: 'Traslado',
      documentNumber: 'TRF-ESPECIAL-001',
    });

    const res = await request(app).get('/finance/transfers').set(auth()).query({
      from: '2026-03-01',
      to: '2026-03-31',
      search: 'ESPECIAL',
    });
    expect(res.status).toBe(200);
    expect(res.body.transfers.length).toBe(1);
  });
});

// ─── References ──────────────────────────────────────────────────────────

describe('GET /finance/transfers/references', () => {
  it('devuelve los medios activos con saldos actuales', async () => {
    const res = await request(app).get('/finance/transfers/references').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.paymentMethods).toBeDefined();
    expect(res.body.paymentMethods.length).toBeGreaterThanOrEqual(4);

    const cash = res.body.paymentMethods.find((m: { id: number }) => m.id === cashMethodId);
    expect(cash).toBeDefined();
    expect(cash.name).toBe(`IT-CASH-${RUN_ID}`);
    expect(cash.currentBalance).toBe('1000.00');
    expect(cash.currency).toBe('COP');
  });

  it('401 sin token', async () => {
    const res = await request(app).get('/finance/transfers/references');
    expect(res.status).toBe(401);
  });
});