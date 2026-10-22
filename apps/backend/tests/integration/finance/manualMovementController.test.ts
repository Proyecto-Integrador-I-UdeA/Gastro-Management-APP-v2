import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import app from '../../../src/app';

const prisma = new PrismaClient();
const RUN_ID = Date.now();
const TEST_PREFIX = `mm-it-${RUN_ID}`;
const TEST_PASSWORD = 'TestMM1234!';
const TEST_EMAIL = `${TEST_PREFIX}@test.local`;

let authToken: string;
let testUserId: number;
let testMethodId: number;

async function login(): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (res.status !== 200 || !res.body?.token) throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

async function getBalance(): Promise<string> {
  const method = await prisma.financePaymentMethod.findUniqueOrThrow({
    where: { id: testMethodId },
    select: { currentBalance: true },
  });
  return method.currentBalance.toFixed(2);
}

beforeAll(async () => {
  const superRole = await prisma.role.findFirstOrThrow({ where: { name: 'super' } });
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
      fullName: `MM IT ${RUN_ID}`,
      roleId: superRole.id,
      active: true,
    },
  });
  testUserId = user.id;

  const method = await prisma.financePaymentMethod.create({
    data: {
      name: `IT-Method-${RUN_ID}`,
      kind: 'CASH',
      currency: 'COP',
      currentBalance: 0,
    },
  });
  testMethodId = method.id;

  authToken = await login();
}, 30_000);

afterAll(async () => {
  try {
    await prisma.financeManualMovement.deleteMany({
      where: { createdBy: { email: TEST_EMAIL } },
    });
    await prisma.financePaymentMethod.deleteMany({ where: { id: testMethodId } });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  } finally {
    await prisma.$disconnect();
  }
}, 30_000);

const auth = () => ({ Authorization: `Bearer ${authToken}` });

describe('POST /finance/movements — auth & validation', () => {
  it('401 sin token', async () => {
    const res = await request(app).post('/finance/movements').send({});
    expect(res.status).toBe(401);
  });

  it('400 si amount ≤ 0', async () => {
    const res = await request(app).post('/finance/movements').set(auth()).send({
      kind: 'INCOME',
      occurredAt: '2026-03-15',
      concept: 'X',
      amount: '0',
      paymentMethodId: testMethodId,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('400 si falta concepto', async () => {
    const res = await request(app).post('/finance/movements').set(auth()).send({
      kind: 'INCOME',
      occurredAt: '2026-03-15',
      amount: '100.00',
      paymentMethodId: testMethodId,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /finance/movements — create', () => {
  it('crea INCOME y sube saldo', async () => {
    const before = await getBalance();
    const res = await request(app).post('/finance/movements').set(auth()).send({
      kind: 'INCOME',
      occurredAt: '2026-03-15',
      concept: 'Ingreso manual test',
      amount: '500.00',
      currency: 'COP',
      paymentMethodId: testMethodId,
    });
    expect(res.status).toBe(201);
    expect(res.body.kind).toBe('INCOME');
    expect(res.body.status).toBe('POSTED');
    expect(res.body.amount).toBe('500.00');
    const after = await getBalance();
    expect(after).toBe((Number(before) + 500).toFixed(2));
  });

  it('crea EXPENSE y baja saldo', async () => {
    const before = await getBalance();
    const res = await request(app).post('/finance/movements').set(auth()).send({
      kind: 'EXPENSE',
      occurredAt: '2026-03-15',
      concept: 'Egreso manual test',
      amount: '200.00',
      currency: 'COP',
      paymentMethodId: testMethodId,
    });
    expect(res.status).toBe(201);
    const after = await getBalance();
    expect(after).toBe((Number(before) - 200).toFixed(2));
  });

  it('crea PENDING sin mover saldo', async () => {
    const before = await getBalance();
    const res = await request(app).post('/finance/movements').set(auth()).send({
      kind: 'INCOME',
      occurredAt: '2026-03-15',
      concept: 'Pendiente test',
      amount: '300.00',
      currency: 'COP',
      paymentMethodId: testMethodId,
      status: 'PENDING',
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    const after = await getBalance();
    expect(after).toBe(before);
  });
});

describe('POST /finance/movements/:id/confirm', () => {
  it('confirma PENDING y mueve saldo', async () => {
    const create = await request(app).post('/finance/movements').set(auth()).send({
      kind: 'INCOME',
      occurredAt: '2026-03-15',
      concept: 'Confirmar test',
      amount: '100.00',
      currency: 'COP',
      paymentMethodId: testMethodId,
      status: 'PENDING',
    });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const before = await getBalance();
    const res = await request(app).post(`/finance/movements/${id}/confirm`).set(auth()).send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('POSTED');
    const after = await getBalance();
    expect(after).toBe((Number(before) + 100).toFixed(2));
  });

  it('confirmar movimiento ya POSTED es idempotente', async () => {
    const create = await request(app).post('/finance/movements').set(auth()).send({
      kind: 'INCOME',
      occurredAt: '2026-03-15',
      concept: 'Idempotente test',
      amount: '50.00',
      currency: 'COP',
      paymentMethodId: testMethodId,
    });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const before = await getBalance();
    const res = await request(app).post(`/finance/movements/${id}/confirm`).set(auth()).send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('POSTED');
    const after = await getBalance();
    expect(after).toBe(before);
  });

  it('confirmar movimiento cancelado → 409', async () => {
    const create = await request(app).post('/finance/movements').set(auth()).send({
      kind: 'INCOME',
      occurredAt: '2026-03-15',
      concept: 'Cancelado test',
      amount: '100.00',
      currency: 'COP',
      paymentMethodId: testMethodId,
    });
    const id = create.body.id;

    await request(app).post(`/finance/movements/${id}/cancel`).set(auth()).send({
      reason: 'test',
    });

    const res = await request(app).post(`/finance/movements/${id}/confirm`).set(auth()).send({});
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('MOVEMENT_NOT_CONFIRMABLE');
  });
});

describe('POST /finance/movements/:id/cancel', () => {
  it('cancela POSTED y revierte saldo', async () => {
    const create = await request(app).post('/finance/movements').set(auth()).send({
      kind: 'INCOME',
      occurredAt: '2026-03-15',
      concept: 'Cancelar test',
      amount: '400.00',
      currency: 'COP',
      paymentMethodId: testMethodId,
    });
    const id = create.body.id;
    const before = await getBalance();

    const res = await request(app).post(`/finance/movements/${id}/cancel`).set(auth()).send({
      reason: 'Error de captura',
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
    const after = await getBalance();
    expect(after).toBe((Number(before) - 400).toFixed(2));
  });

  it('cancelar dos veces es idempotente', async () => {
    const create = await request(app).post('/finance/movements').set(auth()).send({
      kind: 'INCOME',
      occurredAt: '2026-03-15',
      concept: 'Doble cancel',
      amount: '100.00',
      currency: 'COP',
      paymentMethodId: testMethodId,
    });
    const id = create.body.id;

    await request(app).post(`/finance/movements/${id}/cancel`).set(auth()).send({ reason: 'primera' });
    const before = await getBalance();

    const res = await request(app).post(`/finance/movements/${id}/cancel`).set(auth()).send({ reason: 'segunda' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
    const after = await getBalance();
    expect(after).toBe(before);
  });
});

describe('GET /finance/movements — list & search', () => {
  it('lista movimientos del rango', async () => {
    const res = await request(app).get('/finance/movements').set(auth()).query({
      from: '2026-03-01',
      to: '2026-03-31',
    });
    expect(res.status).toBe(200);
    expect(res.body.movements.length).toBeGreaterThan(0);
  });

  it('filtra por kind=EXPENSE', async () => {
    const res = await request(app).get('/finance/movements').set(auth()).query({
      from: '2026-03-01',
      to: '2026-03-31',
      kind: 'EXPENSE',
    });
    expect(res.status).toBe(200);
    expect(res.body.movements.every((m: { kind: string }) => m.kind === 'EXPENSE')).toBe(true);
  });

  it('search por concepto', async () => {
    const res = await request(app).get('/finance/movements').set(auth()).query({
      from: '2026-03-01',
      to: '2026-03-31',
      search: 'Cancelar',
    });
    expect(res.status).toBe(200);
    expect(res.body.movements.length).toBeGreaterThan(0);
    expect(res.body.movements[0].concept).toContain('Cancelar');
  });
});

describe('GET /finance/movements/summary', () => {
  it('agrega movimientos del día', async () => {
    const res = await request(app).get('/finance/movements/summary').set(auth()).query({
      date: '2026-03-15',
    });
    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2026-03-15');
    expect(res.body.day).toBeDefined();
    expect(res.body.month).toBeDefined();
    expect(res.body.byPaymentMethod.length).toBeGreaterThan(0);
  });
});