import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import type {
  CreateFinanceEmployeeInput,
  UpdateFinanceEmployeeInput,
  UpdateFinancePayrollEntryInput,
} from '../../schemas/financePayrollSchema';

export class FinanceEmployeeNotFoundError extends Error {
  constructor() {
    super('El colaborador no existe');
    this.name = 'FinanceEmployeeNotFoundError';
  }
}

export class DuplicateFinanceEmployeeError extends Error {
  constructor() {
    super('Ya existe un colaborador con ese documento');
    this.name = 'DuplicateFinanceEmployeeError';
  }
}

export class FinancePayrollNotFoundError extends Error {
  constructor() {
    super('La nómina del periodo no existe');
    this.name = 'FinancePayrollNotFoundError';
  }
}

export class InvalidFinancePayrollError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFinancePayrollError';
  }
}

export const PAYROLL_AREAS = ['KITCHEN', 'SERVICE', 'ADMIN', 'SUPPORT'] as const;
export type FinancePayrollArea = (typeof PAYROLL_AREAS)[number];

export const MONTHLY_HOURS = 210;
export const DAY_OVERTIME_FACTOR = 1.25;
export const NIGHT_OVERTIME_FACTOR = 1.75;
export const NIGHT_SURCHARGE_FACTOR = 0.35;
export const REST_DAY_DAY_FACTOR = 0.90;
export const REST_DAY_NIGHT_FACTOR = 1.25;
export const EMPLOYEE_HEALTH_RATE = 0.04;
export const EMPLOYEE_PENSION_RATE = 0.04;
export const EMPLOYER_HEALTH_RATE = 0.085;
export const EMPLOYER_PENSION_RATE = 0.12;
export const MINIMUM_SALARY_2026 = 1_750_905;
export const TRANSPORT_AID_LIMIT = 3_501_810;
export const TRANSPORT_AID_2026 = 249_095;
export const CALCULATION_VERSION = 'CO_BASIC_2026_V1';
export const ARL_RATES = {
  I: 0.00522,
  II: 0.01044,
  III: 0.02436,
  IV: 0.04350,
  V: 0.06960,
} as const;
export type FinanceArlRiskClass = keyof typeof ARL_RATES;

type DecimalValue = Prisma.Decimal | number | string;

function decimal(value: DecimalValue) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

function roundedMoney(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function calculateEmployerSocialSecurity(input: {
  contributionBase: DecimalValue;
  employerHealthContributionApplies: boolean;
  arlRiskClass: FinanceArlRiskClass;
}) {
  const contributionBase = roundedMoney(decimal(input.contributionBase));
  const employeeHealthDeduction = roundedMoney(contributionBase.mul(EMPLOYEE_HEALTH_RATE));
  const employerHealthContribution = input.employerHealthContributionApplies
    ? roundedMoney(contributionBase.mul(EMPLOYER_HEALTH_RATE))
    : new Prisma.Decimal(0);
  const totalHealthContribution = roundedMoney(
    employeeHealthDeduction.add(employerHealthContribution),
  );
  const employeePensionDeduction = roundedMoney(contributionBase.mul(EMPLOYEE_PENSION_RATE));
  const employerPensionContribution = roundedMoney(
    contributionBase.mul(EMPLOYER_PENSION_RATE),
  );
  const totalPensionContribution = roundedMoney(
    employeePensionDeduction.add(employerPensionContribution),
  );
  const arlRate = new Prisma.Decimal(ARL_RATES[input.arlRiskClass]);
  const employerArlContribution = roundedMoney(contributionBase.mul(arlRate));
  const employerSocialSecurityCost = roundedMoney(
    employerHealthContribution.add(employerPensionContribution).add(employerArlContribution),
  );
  const totalSocialSecurityPayment = roundedMoney(
    totalHealthContribution.add(totalPensionContribution).add(employerArlContribution),
  );

  return {
    contributionBase,
    employeeHealthDeduction,
    employerHealthContribution,
    totalHealthContribution,
    employeePensionDeduction,
    employerPensionContribution,
    totalPensionContribution,
    arlRiskClass: input.arlRiskClass,
    arlRate,
    employerArlContribution,
    totalSocialSecurityPayment,
    employerSocialSecurityCost,
  };
}

export function calculateBenefitProvisions(input: {
  salary: DecimalValue;
  dayOvertimePay: DecimalValue;
  nightOvertimePay: DecimalValue;
  nightSurchargePay: DecimalValue;
  restDayDayPay: DecimalValue;
  restDayNightPay: DecimalValue;
  transportAid: DecimalValue;
}) {
  const salary = roundedMoney(decimal(input.salary));
  const dayOvertimePay = roundedMoney(decimal(input.dayOvertimePay));
  const nightOvertimePay = roundedMoney(decimal(input.nightOvertimePay));
  const nightSurchargePay = roundedMoney(decimal(input.nightSurchargePay));
  const restDayDayPay = roundedMoney(decimal(input.restDayDayPay));
  const restDayNightPay = roundedMoney(decimal(input.restDayNightPay));
  const transportAid = roundedMoney(decimal(input.transportAid));
  const prestationsBase = roundedMoney(
    salary
      .add(dayOvertimePay)
      .add(nightOvertimePay)
      .add(nightSurchargePay)
      .add(restDayDayPay)
      .add(restDayNightPay)
      .add(transportAid),
  );
  const primaProvision = roundedMoney(prestationsBase.div(12));
  const severanceProvision = roundedMoney(prestationsBase.div(12));
  const severanceInterestProvision = roundedMoney(severanceProvision.mul(0.12));
  const vacationProvision = roundedMoney(salary.add(nightSurchargePay).div(24));
  const benefits = roundedMoney(
    primaProvision.add(severanceProvision).add(severanceInterestProvision).add(vacationProvision),
  );

  return {
    prestationsBase,
    primaProvision,
    severanceProvision,
    severanceInterestProvision,
    vacationProvision,
    benefits,
  };
}

export function calculateBasicPayroll(input: {
  salary: DecimalValue;
  dayOvertimeHours: DecimalValue;
  nightOvertimeHours: DecimalValue;
  nightSurchargeHours: DecimalValue;
  restDayDayHours?: DecimalValue;
  restDayNightHours?: DecimalValue;
  otherDeductions: DecimalValue;
  transportAidEligible: boolean;
  employerHealthContributionApplies?: boolean;
  arlRiskClass?: FinanceArlRiskClass;
}) {
  const salary = roundedMoney(decimal(input.salary));
  const dayOvertimeHours = decimal(input.dayOvertimeHours);
  const nightOvertimeHours = decimal(input.nightOvertimeHours);
  const nightSurchargeHours = decimal(input.nightSurchargeHours);
  const restDayDayHours = decimal(input.restDayDayHours ?? 0);
  const restDayNightHours = decimal(input.restDayNightHours ?? 0);
  const otherDeductions = roundedMoney(decimal(input.otherDeductions));
  const ordinaryHourlyRateRaw = salary.div(MONTHLY_HOURS);
  const dayOvertimePay = roundedMoney(
    ordinaryHourlyRateRaw.mul(DAY_OVERTIME_FACTOR).mul(dayOvertimeHours),
  );
  const nightOvertimePay = roundedMoney(
    ordinaryHourlyRateRaw.mul(NIGHT_OVERTIME_FACTOR).mul(nightOvertimeHours),
  );
  const nightSurchargePay = roundedMoney(
    ordinaryHourlyRateRaw.mul(NIGHT_SURCHARGE_FACTOR).mul(nightSurchargeHours),
  );
  const restDayDayPay = roundedMoney(
    ordinaryHourlyRateRaw.mul(REST_DAY_DAY_FACTOR).mul(restDayDayHours),
  );
  const restDayNightPay = roundedMoney(
    ordinaryHourlyRateRaw.mul(REST_DAY_NIGHT_FACTOR).mul(restDayNightHours),
  );
  const extras = roundedMoney(
    dayOvertimePay
      .add(nightOvertimePay)
      .add(nightSurchargePay)
      .add(restDayDayPay)
      .add(restDayNightPay),
  );
  const transportAid = input.transportAidEligible && salary.lte(TRANSPORT_AID_LIMIT)
    ? new Prisma.Decimal(TRANSPORT_AID_2026)
    : new Prisma.Decimal(0);
  const contributionBase = roundedMoney(salary.add(extras));
  const healthDeduction = roundedMoney(contributionBase.mul(EMPLOYEE_HEALTH_RATE));
  const pensionDeduction = roundedMoney(contributionBase.mul(EMPLOYEE_PENSION_RATE));
  const deductions = roundedMoney(healthDeduction.add(pensionDeduction).add(otherDeductions));
  const totalAccrued = roundedMoney(salary.add(extras).add(transportAid));
  const net = roundedMoney(totalAccrued.sub(deductions));
  const provisions = calculateBenefitProvisions({
    salary,
    dayOvertimePay,
    nightOvertimePay,
    nightSurchargePay,
    restDayDayPay,
    restDayNightPay,
    transportAid,
  });
  const socialSecurity = calculateEmployerSocialSecurity({
    contributionBase,
    employerHealthContributionApplies: input.employerHealthContributionApplies ?? true,
    arlRiskClass: input.arlRiskClass ?? 'I',
  });
  const employerCost = roundedMoney(
    totalAccrued.add(provisions.benefits).add(socialSecurity.employerSocialSecurityCost),
  );
  const immediatePayrollCashOutflow = roundedMoney(
    net.add(socialSecurity.totalSocialSecurityPayment),
  );

  return {
    salary,
    ordinaryHourlyRate: roundedMoney(ordinaryHourlyRateRaw),
    dayOvertimeHours,
    dayOvertimePay,
    nightOvertimeHours,
    nightOvertimePay,
    nightSurchargeHours,
    nightSurchargePay,
    restDayDayHours,
    restDayDayPay,
    restDayNightHours,
    restDayNightPay,
    extras,
    transportAid,
    totalAccrued,
    healthDeduction,
    pensionDeduction,
    otherDeductions,
    deductions,
    net,
    ...provisions,
    ...socialSecurity,
    employerCost,
    immediatePayrollCashOutflow,
  };
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function money(value: Prisma.Decimal | number) {
  return Number(Number(value).toFixed(2));
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function serializeEmployee(employee: {
  id: number;
  fullName: string;
  nationalId: string;
  area: FinancePayrollArea;
  position: string;
  hiredAt: Date;
  monthlySalary: Prisma.Decimal;
  transportAidEligible: boolean;
  employerHealthContributionApplies: boolean;
  arlRiskClass: FinanceArlRiskClass;
  active: boolean;
}) {
  return {
    id: employee.id,
    fullName: employee.fullName,
    nationalId: employee.nationalId,
    area: employee.area,
    position: employee.position,
    hiredAt: formatDateOnly(employee.hiredAt),
    monthlySalary: money(employee.monthlySalary),
    transportAidEligible: employee.transportAidEligible,
    employerHealthContributionApplies: employee.employerHealthContributionApplies,
    arlRiskClass: employee.arlRiskClass,
    active: employee.active,
  };
}

function serializeEntry(entry: {
  id: number;
  periodId: number;
  employeeId: number;
  fullName: string;
  nationalId: string;
  area: FinancePayrollArea;
  position: string;
  salary: Prisma.Decimal;
  extras: Prisma.Decimal;
  deductions: Prisma.Decimal;
  benefits: Prisma.Decimal;
  dayOvertimeHours: Prisma.Decimal;
  nightOvertimeHours: Prisma.Decimal;
  nightSurchargeHours: Prisma.Decimal;
  restDayDayHours: Prisma.Decimal;
  restDayNightHours: Prisma.Decimal;
  transportAid: Prisma.Decimal;
  healthDeduction: Prisma.Decimal;
  pensionDeduction: Prisma.Decimal;
  otherDeductions: Prisma.Decimal;
  calculationVersion: string | null;
  employerHealthContributionApplies: boolean;
  arlRiskClass: FinanceArlRiskClass;
  note: string | null;
}) {
  const salary = money(entry.salary);
  const extras = money(entry.extras);
  const deductions = money(entry.deductions);
  const benefits = money(entry.benefits);
  const isAutomatic = entry.calculationVersion === CALCULATION_VERSION;
  const transportAid = money(entry.transportAid);
  const totalAccrued = Number((salary + extras + (isAutomatic ? transportAid : 0)).toFixed(2));
  const gross = totalAccrued;
  const net = Number((totalAccrued - deductions).toFixed(2));
  const ordinaryHourlyRate = isAutomatic
    ? money(new Prisma.Decimal(entry.salary).div(MONTHLY_HOURS))
    : 0;
  const dayOvertimePay = isAutomatic
    ? money(new Prisma.Decimal(entry.salary).div(MONTHLY_HOURS).mul(DAY_OVERTIME_FACTOR).mul(entry.dayOvertimeHours))
    : 0;
  const nightOvertimePay = isAutomatic
    ? money(new Prisma.Decimal(entry.salary).div(MONTHLY_HOURS).mul(NIGHT_OVERTIME_FACTOR).mul(entry.nightOvertimeHours))
    : 0;
  const nightSurchargePay = isAutomatic
    ? money(new Prisma.Decimal(entry.salary).div(MONTHLY_HOURS).mul(NIGHT_SURCHARGE_FACTOR).mul(entry.nightSurchargeHours))
    : 0;
  const restDayDayPay = isAutomatic
    ? money(new Prisma.Decimal(entry.salary).div(MONTHLY_HOURS).mul(REST_DAY_DAY_FACTOR).mul(entry.restDayDayHours))
    : 0;
  const restDayNightPay = isAutomatic
    ? money(new Prisma.Decimal(entry.salary).div(MONTHLY_HOURS).mul(REST_DAY_NIGHT_FACTOR).mul(entry.restDayNightHours))
    : 0;
  const provisions = isAutomatic
    ? calculateBenefitProvisions({
      salary: entry.salary,
      dayOvertimePay,
      nightOvertimePay,
      nightSurchargePay,
      restDayDayPay,
      restDayNightPay,
      transportAid: entry.transportAid,
    })
    : null;
  const socialSecurity = isAutomatic
    ? calculateEmployerSocialSecurity({
      contributionBase: new Prisma.Decimal(entry.salary).add(entry.extras),
      employerHealthContributionApplies: entry.employerHealthContributionApplies,
      arlRiskClass: entry.arlRiskClass,
    })
    : null;
  const employerSocialSecurityCost = socialSecurity
    ? money(socialSecurity.employerSocialSecurityCost)
    : 0;
  const employerCost = Number(
    (totalAccrued + benefits + employerSocialSecurityCost).toFixed(2),
  );
  const totalSocialSecurityPayment = socialSecurity
    ? money(socialSecurity.totalSocialSecurityPayment)
    : 0;
  const immediatePayrollCashOutflow = Number(
    (net + totalSocialSecurityPayment).toFixed(2),
  );

  return {
    id: entry.id,
    periodId: entry.periodId,
    employeeId: entry.employeeId,
    fullName: entry.fullName,
    nationalId: entry.nationalId,
    area: entry.area,
    position: entry.position,
    salary,
    extras,
    deductions,
    benefits,
    dayOvertimeHours: Number(entry.dayOvertimeHours),
    dayOvertimePay,
    nightOvertimeHours: Number(entry.nightOvertimeHours),
    nightOvertimePay,
    nightSurchargeHours: Number(entry.nightSurchargeHours),
    nightSurchargePay,
    restDayDayHours: Number(entry.restDayDayHours),
    restDayDayPay,
    restDayNightHours: Number(entry.restDayNightHours),
    restDayNightPay,
    ordinaryHourlyRate,
    transportAid,
    totalAccrued,
    healthDeduction: money(entry.healthDeduction),
    pensionDeduction: money(entry.pensionDeduction),
    otherDeductions: money(entry.otherDeductions),
    totalDeductions: deductions,
    contributionBase: socialSecurity ? money(socialSecurity.contributionBase) : 0,
    employeeHealthDeduction: money(entry.healthDeduction),
    employerHealthContributionApplies: entry.employerHealthContributionApplies,
    employerHealthContribution: socialSecurity ? money(socialSecurity.employerHealthContribution) : 0,
    totalHealthContribution: socialSecurity ? money(socialSecurity.totalHealthContribution) : money(entry.healthDeduction),
    employeePensionDeduction: money(entry.pensionDeduction),
    employerPensionContribution: socialSecurity ? money(socialSecurity.employerPensionContribution) : 0,
    totalPensionContribution: socialSecurity ? money(socialSecurity.totalPensionContribution) : money(entry.pensionDeduction),
    arlRiskClass: entry.arlRiskClass,
    arlRate: socialSecurity ? Number(socialSecurity.arlRate) : 0,
    employerArlContribution: socialSecurity ? money(socialSecurity.employerArlContribution) : 0,
    totalSocialSecurityPayment,
    employerSocialSecurityCost,
    immediatePayrollCashOutflow,
    prestationsBase: provisions ? money(provisions.prestationsBase) : 0,
    primaProvision: provisions ? money(provisions.primaProvision) : 0,
    severanceProvision: provisions ? money(provisions.severanceProvision) : 0,
    severanceInterestProvision: provisions ? money(provisions.severanceInterestProvision) : 0,
    vacationProvision: provisions ? money(provisions.vacationProvision) : 0,
    calculationVersion: entry.calculationVersion,
    note: entry.note,
    gross,
    net,
    employerCost,
  };
}

export function summarizePayroll(
  entries: Array<{
    area: FinancePayrollArea;
    salary: number;
    extras: number;
    deductions: number;
    benefits: number;
    transportAid: number;
    totalAccrued: number;
    healthDeduction: number;
    pensionDeduction: number;
    otherDeductions: number;
    totalDeductions: number;
    net: number;
    employerCost: number;
    totalSocialSecurityPayment: number;
    employerSocialSecurityCost: number;
    immediatePayrollCashOutflow: number;
  }>,
) {
  const byArea = PAYROLL_AREAS.map(area => {
    const rows = entries.filter(entry => entry.area === area);
    return {
      area,
      employeeCount: rows.length,
      salaries: Number(rows.reduce((total, row) => total + row.salary, 0).toFixed(2)),
      extras: Number(rows.reduce((total, row) => total + row.extras, 0).toFixed(2)),
      transportAid: Number(rows.reduce((total, row) => total + row.transportAid, 0).toFixed(2)),
      totalAccrued: Number(rows.reduce((total, row) => total + row.totalAccrued, 0).toFixed(2)),
      totalDeductions: Number(rows.reduce((total, row) => total + row.totalDeductions, 0).toFixed(2)),
      net: Number(rows.reduce((total, row) => total + row.net, 0).toFixed(2)),
      benefits: Number(rows.reduce((total, row) => total + row.benefits, 0).toFixed(2)),
      totalSocialSecurityPayment: Number(rows.reduce((total, row) => total + row.totalSocialSecurityPayment, 0).toFixed(2)),
      employerSocialSecurityCost: Number(rows.reduce((total, row) => total + row.employerSocialSecurityCost, 0).toFixed(2)),
      immediatePayrollCashOutflow: Number(rows.reduce((total, row) => total + row.immediatePayrollCashOutflow, 0).toFixed(2)),
      total: Number(rows.reduce((total, row) => total + row.employerCost, 0).toFixed(2)),
    };
  });

  return {
    byArea,
    totals: {
      employeeCount: entries.length,
      salaries: Number(entries.reduce((total, row) => total + row.salary, 0).toFixed(2)),
      extras: Number(entries.reduce((total, row) => total + row.extras, 0).toFixed(2)),
      deductions: Number(entries.reduce((total, row) => total + row.deductions, 0).toFixed(2)),
      benefits: Number(entries.reduce((total, row) => total + row.benefits, 0).toFixed(2)),
      transportAid: Number(entries.reduce((total, row) => total + row.transportAid, 0).toFixed(2)),
      totalAccrued: Number(entries.reduce((total, row) => total + row.totalAccrued, 0).toFixed(2)),
      healthDeduction: Number(entries.reduce((total, row) => total + row.healthDeduction, 0).toFixed(2)),
      pensionDeduction: Number(entries.reduce((total, row) => total + row.pensionDeduction, 0).toFixed(2)),
      otherDeductions: Number(entries.reduce((total, row) => total + row.otherDeductions, 0).toFixed(2)),
      totalDeductions: Number(entries.reduce((total, row) => total + row.totalDeductions, 0).toFixed(2)),
      net: Number(entries.reduce((total, row) => total + row.net, 0).toFixed(2)),
      totalSocialSecurityPayment: Number(entries.reduce((total, row) => total + row.totalSocialSecurityPayment, 0).toFixed(2)),
      employerSocialSecurityCost: Number(entries.reduce((total, row) => total + row.employerSocialSecurityCost, 0).toFixed(2)),
      immediatePayrollCashOutflow: Number(entries.reduce((total, row) => total + row.immediatePayrollCashOutflow, 0).toFixed(2)),
      employerCost: Number(entries.reduce((total, row) => total + row.employerCost, 0).toFixed(2)),
    },
  };
}

function assertOpenPeriod(status: 'OPEN' | 'CLOSED') {
  if (status === 'CLOSED') {
    throw new InvalidFinancePayrollError('La nómina del periodo ya está cerrada');
  }
}

function assertEntryMoney(salary: number, extras: number, deductions: number, benefits: number) {
  if (salary < 0 || extras < 0 || deductions < 0 || benefits < 0) {
    throw new InvalidFinancePayrollError('Los valores de nómina no pueden ser negativos');
  }
  if (deductions - (salary + extras) > 0.001) {
    throw new InvalidFinancePayrollError('Las deducciones no pueden superar el salario más extras');
  }
}

export async function listFinanceEmployees() {
  const employees = await prisma.financeEmployee.findMany({
    orderBy: [{ active: 'desc' }, { fullName: 'asc' }],
  });
  return employees.map(serializeEmployee);
}

export async function createFinanceEmployee(input: CreateFinanceEmployeeInput) {
  try {
    const created = await prisma.financeEmployee.create({
      data: {
        fullName: input.fullName,
        nationalId: input.nationalId,
        area: input.area,
        position: input.position,
        hiredAt: parseDateOnly(input.hiredAt),
        monthlySalary: new Prisma.Decimal(input.monthlySalary.toFixed(2)),
        transportAidEligible: input.transportAidEligible,
        employerHealthContributionApplies: input.employerHealthContributionApplies,
        arlRiskClass: input.arlRiskClass,
        active: input.active,
      },
    });
    return serializeEmployee(created);
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateFinanceEmployeeError();
    throw error;
  }
}

export async function updateFinanceEmployee(id: number, input: UpdateFinanceEmployeeInput) {
  const current = await prisma.financeEmployee.findUnique({ where: { id } });
  if (!current) throw new FinanceEmployeeNotFoundError();

  try {
    const updated = await prisma.financeEmployee.update({
      where: { id },
      data: {
        fullName: input.fullName ?? current.fullName,
        nationalId: input.nationalId ?? current.nationalId,
        area: input.area ?? current.area,
        position: input.position ?? current.position,
        hiredAt: input.hiredAt ? parseDateOnly(input.hiredAt) : current.hiredAt,
        monthlySalary: input.monthlySalary === undefined
          ? undefined
          : new Prisma.Decimal(input.monthlySalary.toFixed(2)),
        transportAidEligible: input.transportAidEligible ?? current.transportAidEligible,
        employerHealthContributionApplies:
          input.employerHealthContributionApplies ?? current.employerHealthContributionApplies,
        arlRiskClass: input.arlRiskClass ?? current.arlRiskClass,
        active: input.active ?? current.active,
      },
    });
    return serializeEmployee(updated);
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateFinanceEmployeeError();
    throw error;
  }
}

export async function deleteFinanceEmployee(id: number) {
  const current = await prisma.financeEmployee.findUnique({
    where: { id },
    include: { _count: { select: { entries: true } } },
  });
  if (!current) throw new FinanceEmployeeNotFoundError();

  if (current._count.entries > 0) {
    await prisma.financeEmployee.update({
      where: { id },
      data: { active: false },
    });
    return;
  }

  await prisma.financeEmployee.delete({ where: { id } });
}

export async function getFinancePayroll(month: string) {
  const [employees, period] = await Promise.all([
    listFinanceEmployees(),
    prisma.financePayrollPeriod.findUnique({
      where: { month },
      include: { entries: { orderBy: [{ area: 'asc' }, { fullName: 'asc' }] } },
    }),
  ]);

  if (!period) {
    return { month, employees, period: null };
  }

  const entries = period.entries.map(serializeEntry);
  const summary = summarizePayroll(entries);

  return {
    month,
    employees,
    period: {
      id: period.id,
      month: period.month,
      status: period.status,
      note: period.note,
      closedAt: period.closedAt ? period.closedAt.toISOString() : null,
      entries,
      ...summary,
    },
  };
}

export async function generateFinancePayroll(month: string) {
  const existing = await prisma.financePayrollPeriod.findUnique({
    where: { month },
    include: { entries: true },
  });
  if (existing?.status === 'CLOSED') {
    throw new InvalidFinancePayrollError('La nómina del periodo ya está cerrada');
  }

  const activeEmployees = await prisma.financeEmployee.findMany({
    where: { active: true },
    orderBy: { fullName: 'asc' },
  });
  if (activeEmployees.length === 0) {
    throw new InvalidFinancePayrollError('No hay colaboradores activos para generar la nómina');
  }

  const alreadyIncluded = new Set(existing?.entries.map(entry => entry.employeeId) ?? []);
  const missing = activeEmployees.filter(employee => !alreadyIncluded.has(employee.id));

  if (!existing && missing.length === 0) {
    throw new InvalidFinancePayrollError('No hay colaboradores activos para generar la nómina');
  }

  const period = existing ?? await prisma.financePayrollPeriod.create({
    data: { month },
  });

  if (missing.length > 0) {
    await prisma.financePayrollEntry.createMany({
      data: missing.map(employee => {
        const calculation = calculateBasicPayroll({
          salary: employee.monthlySalary,
          dayOvertimeHours: 0,
          nightOvertimeHours: 0,
          nightSurchargeHours: 0,
          restDayDayHours: 0,
          restDayNightHours: 0,
          otherDeductions: 0,
          transportAidEligible: employee.transportAidEligible,
          employerHealthContributionApplies: employee.employerHealthContributionApplies,
          arlRiskClass: employee.arlRiskClass,
        });
        return {
          periodId: period.id,
          employeeId: employee.id,
          fullName: employee.fullName,
          nationalId: employee.nationalId,
          area: employee.area,
          position: employee.position,
          salary: employee.monthlySalary,
          extras: calculation.extras,
          deductions: calculation.deductions,
          dayOvertimeHours: calculation.dayOvertimeHours,
          nightOvertimeHours: calculation.nightOvertimeHours,
          nightSurchargeHours: calculation.nightSurchargeHours,
          restDayDayHours: calculation.restDayDayHours,
          restDayNightHours: calculation.restDayNightHours,
          transportAid: calculation.transportAid,
          healthDeduction: calculation.healthDeduction,
          pensionDeduction: calculation.pensionDeduction,
          otherDeductions: calculation.otherDeductions,
          benefits: calculation.benefits,
          employerHealthContributionApplies: employee.employerHealthContributionApplies,
          arlRiskClass: employee.arlRiskClass,
          calculationVersion: CALCULATION_VERSION,
        };
      }),
    });
  }

  return getFinancePayroll(month);
}

export async function updateFinancePayrollEntry(id: number, input: UpdateFinancePayrollEntryInput) {
  const current = await prisma.financePayrollEntry.findUnique({
    where: { id },
    include: { period: true },
  });
  if (!current) throw new FinancePayrollNotFoundError();
  assertOpenPeriod(current.period.status);

  if (current.calculationVersion === CALCULATION_VERSION) {
    const legacyKeys = ['salary', 'extras', 'deductions', 'benefits'] as const;
    if (legacyKeys.some(key => input[key] !== undefined)) {
      throw new InvalidFinancePayrollError(
        'Los totales de una liquidación automática son calculados por el servidor',
      );
    }

    const calculation = calculateBasicPayroll({
      salary: current.salary,
      dayOvertimeHours: input.dayOvertimeHours ?? current.dayOvertimeHours,
      nightOvertimeHours: input.nightOvertimeHours ?? current.nightOvertimeHours,
      nightSurchargeHours: input.nightSurchargeHours ?? current.nightSurchargeHours,
      restDayDayHours: input.restDayDayHours ?? current.restDayDayHours,
      restDayNightHours: input.restDayNightHours ?? current.restDayNightHours,
      otherDeductions: input.otherDeductions ?? current.otherDeductions,
      transportAidEligible: current.transportAid.gt(0),
      employerHealthContributionApplies: current.employerHealthContributionApplies,
      arlRiskClass: current.arlRiskClass,
    });
    if (calculation.net.lt(0)) {
      throw new InvalidFinancePayrollError('Las deducciones no pueden superar el total devengado');
    }

    const updated = await prisma.financePayrollEntry.update({
      where: { id },
      data: {
        dayOvertimeHours: calculation.dayOvertimeHours,
        nightOvertimeHours: calculation.nightOvertimeHours,
        nightSurchargeHours: calculation.nightSurchargeHours,
        restDayDayHours: calculation.restDayDayHours,
        restDayNightHours: calculation.restDayNightHours,
        extras: calculation.extras,
        transportAid: calculation.transportAid,
        healthDeduction: calculation.healthDeduction,
        pensionDeduction: calculation.pensionDeduction,
        otherDeductions: calculation.otherDeductions,
        deductions: calculation.deductions,
        benefits: calculation.benefits,
        note: input.note === undefined ? current.note : input.note,
      },
    });
    return serializeEntry(updated);
  }

  if (
    input.dayOvertimeHours !== undefined
    || input.nightOvertimeHours !== undefined
    || input.nightSurchargeHours !== undefined
    || input.restDayDayHours !== undefined
    || input.restDayNightHours !== undefined
    || input.otherDeductions !== undefined
  ) {
    throw new InvalidFinancePayrollError('La línea histórica conserva el ajuste monetario legacy');
  }

  const salary = input.salary ?? money(current.salary);
  const extras = input.extras ?? money(current.extras);
  const deductions = input.deductions ?? money(current.deductions);
  const benefits = input.benefits ?? money(current.benefits);
  assertEntryMoney(salary, extras, deductions, benefits);

  const updated = await prisma.financePayrollEntry.update({
    where: { id },
    data: {
      salary: new Prisma.Decimal(salary.toFixed(2)),
      extras: new Prisma.Decimal(extras.toFixed(2)),
      deductions: new Prisma.Decimal(deductions.toFixed(2)),
      benefits: new Prisma.Decimal(benefits.toFixed(2)),
      note: input.note === undefined ? current.note : input.note,
    },
  });
  return serializeEntry(updated);
}

export async function deleteFinancePayrollEntry(id: number) {
  const current = await prisma.financePayrollEntry.findUnique({
    where: { id },
    include: { period: true },
  });
  if (!current) throw new FinancePayrollNotFoundError();
  assertOpenPeriod(current.period.status);
  await prisma.financePayrollEntry.delete({ where: { id } });
}

export async function closeFinancePayroll(id: number) {
  const current = await prisma.financePayrollPeriod.findUnique({ where: { id } });
  if (!current) throw new FinancePayrollNotFoundError();
  assertOpenPeriod(current.status);

  const entryCount = await prisma.financePayrollEntry.count({ where: { periodId: id } });
  if (entryCount === 0) {
    throw new InvalidFinancePayrollError('No se puede cerrar una nómina sin colaboradores');
  }

  await prisma.financePayrollPeriod.update({
    where: { id },
    data: { status: 'CLOSED', closedAt: new Date() },
  });
  return getFinancePayroll(current.month);
}

export async function reopenFinancePayroll(id: number) {
  const current = await prisma.financePayrollPeriod.findUnique({ where: { id } });
  if (!current) throw new FinancePayrollNotFoundError();
  if (current.status === 'OPEN') {
    throw new InvalidFinancePayrollError('La nómina del periodo ya está abierta');
  }

  await prisma.financePayrollPeriod.update({
    where: { id },
    data: { status: 'OPEN', closedAt: null },
  });
  return getFinancePayroll(current.month);
}
