import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';
import { createIntegrationToken } from './authToken';

const MONTH = '2099-01';
const PREFIX = '__finance_02a__';
const readToken = createIntegrationToken(['accounting.read']);
const writeToken = createIntegrationToken(['accounting.read', 'accounting.update']);

async function clearFixtures() {
  await prisma.financePayrollEntry.deleteMany({
    where: { nationalId: { startsWith: PREFIX } },
  });
  await prisma.financePayrollPeriod.deleteMany({
    where: { month: MONTH, entries: { none: {} } },
  });
  await prisma.financeEmployee.deleteMany({
    where: { nationalId: { startsWith: PREFIX } },
  });
}

beforeEach(clearFixtures);
afterEach(clearFixtures);
afterAll(async () => {
  await clearFixtures();
  await prisma.$disconnect();
});

describe('autorización de nómina', () => {
  it('protege GET con accounting.read', async () => {
    expect((await request(app).get('/finance/payroll').query({ month: MONTH })).status).toBe(401);
    const listed = await request(app)
      .get('/finance/payroll')
      .query({ month: MONTH })
      .set('Authorization', `Bearer ${readToken}`);
    expect(listed.status).toBe(200);
  });
});

describe('API de nómina', () => {
  it('crea un colaborador, genera, ajusta, cierra y bloquea ediciones', async () => {
    const created = await request(app)
      .post('/finance/employees')
      .set('Authorization', `Bearer ${writeToken}`)
      .send({
        fullName: `${PREFIX} Ana Rojas`,
        nationalId: `${PREFIX}123`,
        area: 'KITCHEN',
        position: 'Chef',
        hiredAt: '2024-03-01',
        monthlySalary: 850000,
      });
    expect(created.status).toBe(201);

    const generated = await request(app)
      .post('/finance/payroll/generate')
      .set('Authorization', `Bearer ${writeToken}`)
      .send({ month: MONTH });
    expect(generated.status).toBe(201);
    expect(generated.body.period.status).toBe('OPEN');
    expect(generated.body.period.entries).toHaveLength(1);
    expect(generated.body.period.entries[0].salary).toBe(850000);

    const entryId = generated.body.period.entries[0].id;
    const adjusted = await request(app)
      .put(`/finance/payroll/entries/${entryId}`)
      .set('Authorization', `Bearer ${writeToken}`)
      .send({ extras: 50000, deductions: 90000, benefits: 220000 });
    expect(adjusted.status).toBe(200);
    expect(adjusted.body.net).toBe(810000);
    expect(adjusted.body.employerCost).toBe(1120000);

    const closed = await request(app)
      .post(`/finance/payroll/${generated.body.period.id}/close`)
      .set('Authorization', `Bearer ${writeToken}`);
    expect(closed.status).toBe(200);
    expect(closed.body.period.status).toBe('CLOSED');

    const blocked = await request(app)
      .put(`/finance/payroll/entries/${entryId}`)
      .set('Authorization', `Bearer ${writeToken}`)
      .send({ extras: 10 });
    expect(blocked.status).toBe(400);
  });
});
