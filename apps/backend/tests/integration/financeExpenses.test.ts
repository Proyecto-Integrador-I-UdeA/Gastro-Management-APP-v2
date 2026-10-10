import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';
import { createIntegrationToken } from './authToken';

const MONTH = '2026-10';
const PREFIX = '__finance_01a__';
const readToken = createIntegrationToken(['accounting.read']);
const writeToken = createIntegrationToken(['accounting.read', 'accounting.update']);

async function clearFixtures() {
  await prisma.financeExpenseItem.deleteMany({
    where: { concept: { startsWith: PREFIX } },
  });
}

beforeEach(clearFixtures);
afterEach(clearFixtures);
afterAll(async () => {
  await clearFixtures();
  await prisma.$disconnect();
});

describe('autorización de gastos financieros', () => {
  it('protege GET con accounting.read y las mutaciones con accounting.update', async () => {
    expect((await request(app).get('/finance/expenses').query({ month: MONTH })).status).toBe(401);
    expect((await request(app)
      .get('/finance/expenses')
      .query({ month: MONTH })
      .set('Authorization', `Bearer ${createIntegrationToken([])}`)).status).toBe(403);

    const listed = await request(app)
      .get('/finance/expenses')
      .query({ month: MONTH })
      .set('Authorization', `Bearer ${readToken}`);
    expect(listed.status).toBe(200);

    const forbidden = await request(app)
      .post('/finance/expenses')
      .set('Authorization', `Bearer ${readToken}`)
      .send({
        kind: 'FIXED',
        month: MONTH,
        concept: `${PREFIX} arriendo`,
        periodicity: 'MONTHLY',
        amount: 1000,
      });
    expect(forbidden.status).toBe(403);
  });
});

describe('API de gastos financieros', () => {
  it('crea, lista, edita y elimina rubros del periodo', async () => {
    const createdFixed = await request(app)
      .post('/finance/expenses')
      .set('Authorization', `Bearer ${writeToken}`)
      .send({
        kind: 'FIXED',
        month: MONTH,
        concept: `${PREFIX} arriendo`,
        periodicity: 'MONTHLY',
        amount: 8500000,
      });
    expect(createdFixed.status).toBe(201);
    expect(createdFixed.body.kind).toBe('FIXED');
    expect(createdFixed.body.amount).toBe(8500000);

    const createdVariable = await request(app)
      .post('/finance/expenses')
      .set('Authorization', `Bearer ${writeToken}`)
      .send({
        kind: 'VARIABLE',
        month: MONTH,
        concept: `${PREFIX} empaques`,
        base: 'Domicilios',
        amount: 2180000,
      });
    expect(createdVariable.status).toBe(201);

    const listed = await request(app)
      .get('/finance/expenses')
      .query({ month: MONTH })
      .set('Authorization', `Bearer ${readToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.fixed.some((item: { concept: string }) => item.concept === `${PREFIX} arriendo`)).toBe(true);
    expect(listed.body.variable.some((item: { concept: string }) => item.concept === `${PREFIX} empaques`)).toBe(true);
    expect(listed.body.totals.fixed).toBeGreaterThanOrEqual(8500000);
    expect(listed.body.totals.variable).toBeGreaterThanOrEqual(2180000);

    const updated = await request(app)
      .put(`/finance/expenses/${createdFixed.body.id}`)
      .set('Authorization', `Bearer ${writeToken}`)
      .send({ amount: 9000000, active: false });
    expect(updated.status).toBe(200);
    expect(updated.body.amount).toBe(9000000);
    expect(updated.body.active).toBe(false);

    const afterUpdate = await request(app)
      .get('/finance/expenses')
      .query({ month: MONTH })
      .set('Authorization', `Bearer ${readToken}`);
    expect(afterUpdate.body.totals.fixed).toBe(listed.body.totals.fixed - 8500000);

    const removed = await request(app)
      .delete(`/finance/expenses/${createdVariable.body.id}`)
      .set('Authorization', `Bearer ${writeToken}`);
    expect(removed.status).toBe(204);

    const duplicate = await request(app)
      .post('/finance/expenses')
      .set('Authorization', `Bearer ${writeToken}`)
      .send({
        kind: 'FIXED',
        month: MONTH,
        concept: `${PREFIX} arriendo`,
        periodicity: 'MONTHLY',
        amount: 100,
      });
    expect(duplicate.status).toBe(409);
  });
});
