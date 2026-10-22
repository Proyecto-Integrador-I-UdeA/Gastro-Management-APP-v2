import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import type {
  CreateFinanceExpenseInput,
  UpdateFinanceExpenseInput,
} from '../../schemas/financeExpenseSchema';

export class FinanceExpenseNotFoundError extends Error {
  constructor() {
    super('El rubro de gasto no existe');
    this.name = 'FinanceExpenseNotFoundError';
  }
}

export class DuplicateFinanceExpenseError extends Error {
  constructor() {
    super('Ya existe un rubro con ese concepto en el periodo');
    this.name = 'DuplicateFinanceExpenseError';
  }
}

export class InvalidFinanceExpenseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFinanceExpenseError';
  }
}

type ExpenseRecord = {
  id: number;
  kind: 'FIXED' | 'VARIABLE';
  month: string;
  concept: string;
  periodicity: 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'ANNUAL' | null;
  base: string | null;
  amount: Prisma.Decimal;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function serialize(item: ExpenseRecord) {
  return {
    id: item.id,
    kind: item.kind,
    month: item.month,
    concept: item.concept,
    periodicity: item.periodicity,
    base: item.base,
    amount: Number(item.amount),
    active: item.active,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function sumActive(items: Array<{ amount: number; active: boolean }>) {
  return items.reduce((total, item) => (item.active ? total + item.amount : total), 0);
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function assertKindFields(kind: 'FIXED' | 'VARIABLE', periodicity: string | null, base: string | null) {
  if (kind === 'FIXED') {
    if (!periodicity) {
      throw new InvalidFinanceExpenseError('La periodicidad es obligatoria en un gasto fijo');
    }
    if (base) {
      throw new InvalidFinanceExpenseError('Un gasto fijo no usa base de cálculo');
    }
    return;
  }

  if (!base) {
    throw new InvalidFinanceExpenseError('La base es obligatoria en un costo variable');
  }
  if (periodicity) {
    throw new InvalidFinanceExpenseError('Un costo variable no usa periodicidad');
  }
}

export async function listFinanceExpenses(month: string) {
  const items = await prisma.financeExpenseItem.findMany({
    where: { month },
    orderBy: [{ concept: 'asc' }],
  });
  const serialized = items.map(serialize);
  const fixed = serialized.filter(item => item.kind === 'FIXED');
  const variable = serialized.filter(item => item.kind === 'VARIABLE');

  return {
    month,
    fixed,
    variable,
    totals: {
      fixed: sumActive(fixed),
      variable: sumActive(variable),
    },
  };
}

export async function createFinanceExpense(input: CreateFinanceExpenseInput) {
  const periodicity = input.kind === 'FIXED' ? input.periodicity : null;
  const base = input.kind === 'VARIABLE' ? input.base : null;
  assertKindFields(input.kind, periodicity, base);

  try {
    const created = await prisma.financeExpenseItem.create({
      data: {
        kind: input.kind,
        month: input.month,
        concept: input.concept,
        periodicity,
        base,
        amount: new Prisma.Decimal(input.amount.toFixed(2)),
        active: input.active,
      },
    });
    return serialize(created);
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateFinanceExpenseError();
    throw error;
  }
}

export async function updateFinanceExpense(id: number, input: UpdateFinanceExpenseInput) {
  const current = await prisma.financeExpenseItem.findUnique({ where: { id } });
  if (!current) throw new FinanceExpenseNotFoundError();

  const kind = input.kind ?? current.kind;
  const periodicity = input.periodicity === undefined ? current.periodicity : input.periodicity;
  const base = input.base === undefined ? current.base : input.base;
  assertKindFields(kind, periodicity, base);

  try {
    const updated = await prisma.financeExpenseItem.update({
      where: { id },
      data: {
        kind,
        month: input.month ?? current.month,
        concept: input.concept ?? current.concept,
        periodicity,
        base,
        amount: input.amount === undefined
          ? undefined
          : new Prisma.Decimal(input.amount.toFixed(2)),
        active: input.active ?? current.active,
      },
    });
    return serialize(updated);
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateFinanceExpenseError();
    throw error;
  }
}

export async function deleteFinanceExpense(id: number) {
  try {
    await prisma.financeExpenseItem.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new FinanceExpenseNotFoundError();
    }
    throw error;
  }
}
