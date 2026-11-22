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
        transportAidEligible: true,
        employerHealthContributionApplies: true,
        arlRiskClass: 'I',
      });
    expect(created.status).toBe(201);
    expect(created.body.transportAidEligible).toBe(true);
    expect(created.body.employerHealthContributionApplies).toBe(true);
    expect(created.body.arlRiskClass).toBe('I');

    const generated = await request(app)
      .post('/finance/payroll/generate')
      .set('Authorization', `Bearer ${writeToken}`)
      .send({ month: MONTH });
    expect(generated.status).toBe(201);
    expect(generated.body.period.status).toBe('OPEN');
    expect(generated.body.period.entries).toHaveLength(1);
    expect(generated.body.period.entries[0].salary).toBe(850000);
    expect(generated.body.period.entries[0].calculationVersion).toBe('CO_BASIC_2026_V1');
    expect(generated.body.period.entries[0].transportAid).toBe(249095);
    expect(generated.body.period.entries[0].employerHealthContributionApplies).toBe(true);
    expect(generated.body.period.entries[0].arlRiskClass).toBe('I');

    const entryId = generated.body.period.entries[0].id;
    const adjusted = await request(app)
      .put(`/finance/payroll/entries/${entryId}`)
      .set('Authorization', `Bearer ${writeToken}`)
      .send({
        dayOvertimeHours: 2,
        nightOvertimeHours: 3,
        nightSurchargeHours: 4,
        restDayDayHours: 4,
        restDayNightHours: 2,
        otherDeductions: 10000,
      });
    expect(adjusted.status).toBe(200);
    expect(adjusted.body.restDayDayPay).toBe(14571.43);
    expect(adjusted.body.restDayNightPay).toBe(10119.05);
    expect(adjusted.body.extras).toBe(61726.2);
    expect(adjusted.body.healthDeduction).toBe(36469.05);
    expect(adjusted.body.pensionDeduction).toBe(36469.05);
    expect(adjusted.body.totalAccrued).toBe(1160821.2);
    expect(adjusted.body.net).toBe(1077883.1);
    expect(adjusted.body).toMatchObject({
      prestationsBase: 1160821.2,
      primaProvision: 96735.1,
      severanceProvision: 96735.1,
      severanceInterestProvision: 11608.21,
      vacationProvision: 35652.78,
      benefits: 240731.19,
      contributionBase: 911726.2,
      employeeHealthDeduction: 36469.05,
      employerHealthContribution: 77496.73,
      totalHealthContribution: 113965.78,
      employeePensionDeduction: 36469.05,
      employerPensionContribution: 109407.14,
      totalPensionContribution: 145876.19,
      arlRiskClass: 'I',
      arlRate: 0.00522,
      employerArlContribution: 4759.21,
      totalSocialSecurityPayment: 264601.18,
      employerSocialSecurityCost: 191663.08,
      immediatePayrollCashOutflow: 1342484.28,
      employerCost: 1593215.47,
    });

    const manipulated = await request(app)
      .put(`/finance/payroll/entries/${entryId}`)
      .set('Authorization', `Bearer ${writeToken}`)
      .send({ extras: 999999, deductions: 0 });
    expect(manipulated.status).toBe(400);
    expect(manipulated.body.error).toContain('calculados por el servidor');

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

  it('mantiene las líneas históricas con cálculo manual legacy', async () => {
    const employee = await prisma.financeEmployee.create({
      data: {
        fullName: `${PREFIX} Legacy`,
        nationalId: `${PREFIX}legacy`,
        area: 'ADMIN',
        position: 'Auxiliar',
        hiredAt: new Date('2024-03-01T00:00:00.000Z'),
        monthlySalary: 800000,
      },
    });
    const period = await prisma.financePayrollPeriod.create({ data: { month: MONTH } });
    const entry = await prisma.financePayrollEntry.create({
      data: {
        periodId: period.id,
        employeeId: employee.id,
        fullName: employee.fullName,
        nationalId: employee.nationalId,
        area: employee.area,
        position: employee.position,
        salary: 800000,
        calculationVersion: null,
      },
    });

    const adjusted = await request(app)
      .put(`/finance/payroll/entries/${entry.id}`)
      .set('Authorization', `Bearer ${writeToken}`)
      .send({ salary: 800000, extras: 50000, deductions: 90000, benefits: 220000 });

    expect(adjusted.status).toBe(200);
    expect(adjusted.body).toMatchObject({
      calculationVersion: null,
      gross: 850000,
      net: 760000,
      benefits: 220000,
      employerCost: 1070000,
      transportAid: 0,
      prestationsBase: 0,
      primaProvision: 0,
      severanceProvision: 0,
      severanceInterestProvision: 0,
      vacationProvision: 0,
      restDayDayHours: 0,
      restDayDayPay: 0,
      restDayNightHours: 0,
      restDayNightPay: 0,
      employerHealthContribution: 0,
      employerPensionContribution: 0,
      employerArlContribution: 0,
      totalSocialSecurityPayment: 0,
      employerSocialSecurityCost: 0,
      immediatePayrollCashOutflow: 760000,
    });
  });
});
