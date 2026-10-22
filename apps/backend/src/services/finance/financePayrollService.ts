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
  note: string | null;
}) {
  const salary = money(entry.salary);
  const extras = money(entry.extras);
  const deductions = money(entry.deductions);
  const benefits = money(entry.benefits);
  const gross = Number((salary + extras).toFixed(2));
  const net = Number((gross - deductions).toFixed(2));
  const employerCost = Number((gross + benefits).toFixed(2));

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
    net: number;
    employerCost: number;
  }>,
) {
  const byArea = PAYROLL_AREAS.map(area => {
    const rows = entries.filter(entry => entry.area === area);
    return {
      area,
      employeeCount: rows.length,
      salaries: Number(rows.reduce((total, row) => total + row.salary, 0).toFixed(2)),
      extras: Number(rows.reduce((total, row) => total + row.extras, 0).toFixed(2)),
      benefits: Number(rows.reduce((total, row) => total + row.benefits, 0).toFixed(2)),
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
      net: Number(entries.reduce((total, row) => total + row.net, 0).toFixed(2)),
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
      data: missing.map(employee => ({
        periodId: period.id,
        employeeId: employee.id,
        fullName: employee.fullName,
        nationalId: employee.nationalId,
        area: employee.area,
        position: employee.position,
        salary: employee.monthlySalary,
      })),
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
