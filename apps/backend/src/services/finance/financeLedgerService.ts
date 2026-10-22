import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import type {
  CreateFinanceLedgerInput,
  CreateFinanceLedgerPaymentInput,
  UpdateFinanceLedgerInput,
} from '../../schemas/financeLedgerSchema';

export class FinanceLedgerNotFoundError extends Error {
  constructor() {
    super('El documento no existe');
    this.name = 'FinanceLedgerNotFoundError';
  }
}

export class DuplicateFinanceLedgerError extends Error {
  constructor() {
    super('Ya existe un documento con ese número');
    this.name = 'DuplicateFinanceLedgerError';
  }
}

export class InvalidFinanceLedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFinanceLedgerError';
  }
}

export type FinanceLedgerStatus = 'PAID' | 'OVERDUE' | 'UPCOMING' | 'PENDING';

export const LEDGER_DOCUMENT_PREFIX = {
  PAYABLE: 'FC',
  RECEIVABLE: 'FV',
} as const;

const DOCUMENT_NUMBER_PADDING = 5;

export function nextLedgerDocumentNumber(
  side: 'PAYABLE' | 'RECEIVABLE',
  existingNumbers: string[],
) {
  const prefix = LEDGER_DOCUMENT_PREFIX[side];
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  let max = 0;
  for (const value of existingNumbers) {
    const match = value.match(pattern);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}-${String(max + 1).padStart(DOCUMENT_NUMBER_PADDING, '0')}`;
}

async function allocateDocumentNumber(side: 'PAYABLE' | 'RECEIVABLE') {
  const prefix = LEDGER_DOCUMENT_PREFIX[side];
  const rows = await prisma.financeLedgerDocument.findMany({
    where: {
      side,
      documentNumber: { startsWith: `${prefix}-` },
    },
    select: { documentNumber: true },
  });
  return nextLedgerDocumentNumber(side, rows.map(row => row.documentNumber));
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function ledgerDocumentStatus(dueAt: Date, balance: number, today = new Date()): FinanceLedgerStatus {
  if (balance <= 0) return 'PAID';
  const due = startOfUtcDay(dueAt);
  const now = startOfUtcDay(today);
  if (due.getTime() < now.getTime()) return 'OVERDUE';
  const upcomingLimit = new Date(now);
  upcomingLimit.setUTCDate(upcomingLimit.getUTCDate() + 7);
  if (due.getTime() <= upcomingLimit.getTime()) return 'UPCOMING';
  return 'PENDING';
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function serializeDocument(
  document: {
    id: number;
    side: 'PAYABLE' | 'RECEIVABLE';
    supplierId: number | null;
    partyName: string | null;
    documentNumber: string;
    invoiceNumber: string | null;
    issuedAt: Date;
    dueAt: Date;
    amount: Prisma.Decimal;
    supplier: { id: number; name: string } | null;
    payments: Array<{ amount: Prisma.Decimal }>;
  },
) {
  const amount = Number(document.amount);
  const paidAmount = document.payments.reduce((total, payment) => total + Number(payment.amount), 0);
  const balance = Math.max(0, Number((amount - paidAmount).toFixed(2)));

  return {
    id: document.id,
    side: document.side,
    supplierId: document.supplierId,
    partyName: document.side === 'PAYABLE' ? document.supplier?.name ?? document.partyName : document.partyName,
    documentNumber: document.documentNumber,
    invoiceNumber: document.invoiceNumber,
    issuedAt: formatDateOnly(document.issuedAt),
    dueAt: formatDateOnly(document.dueAt),
    amount,
    paidAmount: Number(paidAmount.toFixed(2)),
    balance,
    status: ledgerDocumentStatus(document.dueAt, balance),
  };
}

const documentInclude = {
  supplier: { select: { id: true, name: true } },
  payments: { select: { amount: true } },
} as const;

export async function listFinanceLedger(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));

  const [documents, suppliers] = await Promise.all([
    prisma.financeLedgerDocument.findMany({
      where: { dueAt: { gte: start, lt: end } },
      include: documentInclude,
      orderBy: [{ dueAt: 'asc' }, { documentNumber: 'asc' }],
    }),
    prisma.supplier.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const serialized = documents.map(serializeDocument);
  return {
    month,
    payables: serialized.filter(item => item.side === 'PAYABLE'),
    receivables: serialized.filter(item => item.side === 'RECEIVABLE'),
    suppliers,
  };
}

export async function createFinanceLedger(input: CreateFinanceLedgerInput) {
  if (input.side === 'PAYABLE') {
    const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier) throw new InvalidFinanceLedgerError('El proveedor no existe');
  }

  let attempts = 0;

  while (attempts < 3) {
    const documentNumber = await allocateDocumentNumber(input.side);
    const invoiceNumber = input.side === 'RECEIVABLE'
      ? documentNumber
      : (input.invoiceNumber?.trim() || null);
    try {
      const created = await prisma.financeLedgerDocument.create({
        data: {
          side: input.side,
          supplierId: input.side === 'PAYABLE' ? input.supplierId : null,
          partyName: input.side === 'RECEIVABLE' ? input.partyName : null,
          documentNumber,
          invoiceNumber,
          issuedAt: parseDateOnly(input.issuedAt),
          dueAt: parseDateOnly(input.dueAt),
          amount: new Prisma.Decimal(input.amount.toFixed(2)),
        },
        include: documentInclude,
      });
      return serializeDocument(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        attempts += 1;
        continue;
      }
      throw error;
    }
  }

  throw new DuplicateFinanceLedgerError();
}

export async function updateFinanceLedger(id: number, input: UpdateFinanceLedgerInput) {
  const current = await prisma.financeLedgerDocument.findUnique({
    where: { id },
    include: documentInclude,
  });
  if (!current) throw new FinanceLedgerNotFoundError();

  const nextAmount = input.amount === undefined ? Number(current.amount) : input.amount;
  const paidAmount = current.payments.reduce((total, payment) => total + Number(payment.amount), 0);
  if (nextAmount + 0.001 < paidAmount) {
    throw new InvalidFinanceLedgerError('El valor no puede ser menor que lo ya abonado');
  }

  if (current.side === 'PAYABLE' && input.supplierId) {
    const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier) throw new InvalidFinanceLedgerError('El proveedor no existe');
  }

  const issuedAt = input.issuedAt ? parseDateOnly(input.issuedAt) : current.issuedAt;
  const dueAt = input.dueAt ? parseDateOnly(input.dueAt) : current.dueAt;
  if (dueAt.getTime() < issuedAt.getTime()) {
    throw new InvalidFinanceLedgerError('El vencimiento no puede ser anterior a la emisión');
  }

  try {
    const updated = await prisma.financeLedgerDocument.update({
      where: { id },
      data: {
        supplierId: current.side === 'PAYABLE'
          ? (input.supplierId ?? current.supplierId)
          : null,
        partyName: current.side === 'RECEIVABLE'
          ? (input.partyName ?? current.partyName)
          : null,
        invoiceNumber: current.side === 'RECEIVABLE'
          ? current.documentNumber
          : (input.invoiceNumber !== undefined ? input.invoiceNumber : current.invoiceNumber),
        issuedAt,
        dueAt,
        amount: input.amount === undefined
          ? undefined
          : new Prisma.Decimal(input.amount.toFixed(2)),
      },
      include: documentInclude,
    });
    return serializeDocument(updated);
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateFinanceLedgerError();
    throw error;
  }
}

export async function deleteFinanceLedger(id: number) {
  try {
    await prisma.financeLedgerDocument.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new FinanceLedgerNotFoundError();
    }
    throw error;
  }
}

export async function createFinanceLedgerPayment(id: number, input: CreateFinanceLedgerPaymentInput) {
  const current = await prisma.financeLedgerDocument.findUnique({
    where: { id },
    include: documentInclude,
  });
  if (!current) throw new FinanceLedgerNotFoundError();

  const document = serializeDocument(current);
  if (input.amount - document.balance > 0.001) {
    throw new InvalidFinanceLedgerError('El abono no puede superar el saldo pendiente');
  }

  await prisma.financeLedgerPayment.create({
    data: {
      documentId: id,
      amount: new Prisma.Decimal(input.amount.toFixed(2)),
      paidAt: input.paidAt ? parseDateOnly(input.paidAt) : new Date(),
      note: input.note ?? null,
    },
  });

  const refreshed = await prisma.financeLedgerDocument.findUnique({
    where: { id },
    include: documentInclude,
  });
  if (!refreshed) throw new FinanceLedgerNotFoundError();
  return serializeDocument(refreshed);
}
