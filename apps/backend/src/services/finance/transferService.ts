import {
  FinancePaymentMethodKind,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import prisma from '../../lib/prisma';
import type {
  CreateTransferInput,
  ListTransfersQuery,
} from '../../schemas/finance/transferSchema';

// ─── Tipos internos ────────────────────────────────────────────────────────

type TransferClient = PrismaClient | Prisma.TransactionClient;

export type TransferRow = {
  id: number;
  occurredAt: Date;
  sourceMethodId: number;
  targetMethodId: number;
  amount: Prisma.Decimal;
  currency: string;
  description: string;
  documentNumber: string | null;
  createdById: number;
  createdAt: Date;
  updatedAt: Date;
};

export type MethodRow = {
  id: number;
  name: string;
  kind: FinancePaymentMethodKind;
  currency: string;
  currentBalance: Prisma.Decimal;
};

export type TransferFilter = {
  from?: Date;
  to?: Date;
  sourceMethodId?: number;
  targetMethodId?: number;
  search?: string;
};

export interface TransferDataSource {
  executeTransfer(input: CreateTransferInput, actorId: number): Promise<TransferRow>;
  findTransferById(id: number): Promise<TransferRow | null>;
  listTransfers(filter: TransferFilter): Promise<TransferRow[]>;
  listMethods(): Promise<MethodRow[]>;
}

// ─── Errores ───────────────────────────────────────────────────────────────

export class TransferOperationError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'TransferOperationError';
  }
}

// ─── Utilidades ────────────────────────────────────────────────────────────

function money(value: Prisma.Decimal.Value): string {
  return new Prisma.Decimal(value).toFixed(2);
}

function bogotaStart(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000-05:00`);
}

function addDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// ─── Serialización ─────────────────────────────────────────────────────────

function serializeTransfer(
  row: TransferRow,
  sourceMethod: MethodRow | null,
  targetMethod: MethodRow | null,
) {
  return {
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    amount: money(row.amount),
    currency: row.currency,
    description: row.description,
    documentNumber: row.documentNumber,
    sourceMethod: sourceMethod
      ? {
          id: sourceMethod.id,
          name: sourceMethod.name,
          kind: sourceMethod.kind,
          currency: sourceMethod.currency,
          currentBalance: money(sourceMethod.currentBalance),
        }
      : null,
    targetMethod: targetMethod
      ? {
          id: targetMethod.id,
          name: targetMethod.name,
          kind: targetMethod.kind,
          currency: targetMethod.currency,
          currentBalance: money(targetMethod.currentBalance),
        }
      : null,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── Data source Prisma ────────────────────────────────────────────────────

function buildWhere(filter: TransferFilter): Prisma.FinanceTransferWhereInput {
  const where: Prisma.FinanceTransferWhereInput = {};
  if (filter.from || filter.to) {
    where.occurredAt = {};
    if (filter.from) where.occurredAt.gte = filter.from;
    if (filter.to) where.occurredAt.lt = filter.to;
  }
  if (filter.sourceMethodId) where.sourceMethodId = filter.sourceMethodId;
  if (filter.targetMethodId) where.targetMethodId = filter.targetMethodId;
  if (filter.search && filter.search.trim()) {
    const q = filter.search.trim();
    where.OR = [
      { description: { contains: q, mode: 'insensitive' } },
      { documentNumber: { contains: q, mode: 'insensitive' } },
    ];
  }
  return where;
}

function toTransferRow(row: {
  id: number;
  occurredAt: Date;
  sourceMethodId: number;
  targetMethodId: number;
  amount: Prisma.Decimal;
  currency: string;
  description: string;
  documentNumber: string | null;
  createdById: number;
  createdAt: Date;
  updatedAt: Date;
}): TransferRow {
  return row;
}

export function createPrismaTransferDataSource(
  client: TransferClient = prisma,
): TransferDataSource {
  return {
    async executeTransfer(input, actorId) {
      const amount = new Prisma.Decimal(input.amount);
      const occurredAt = bogotaStart(input.occurredAt);

      return prisma.$transaction(async tx => {
        // ─── 1) Lock del origen ─────────────────────────────────────────
        const sourceRows = await tx.$queryRaw<Array<{
          id: number;
          name: string;
          kind: FinancePaymentMethodKind;
          currency: string;
          currentBalance: Prisma.Decimal;
          active: boolean;
        }>>`
          SELECT id, name, kind, currency, "currentBalance", active
          FROM "finance_payment_methods"
          WHERE id = ${input.sourceMethodId}
          FOR UPDATE
        `;
        const source = sourceRows[0];
        if (!source) {
          throw new TransferOperationError(
            'TRANSFER_SOURCE_NOT_FOUND',
            404,
            'El medio de origen no existe',
          );
        }
        if (!source.active) {
          throw new TransferOperationError(
            'TRANSFER_SOURCE_INACTIVE',
            409,
            'El medio de origen está inactivo',
          );
        }

        // ─── 2) Lock del destino ────────────────────────────────────────
        const targetRows = await tx.$queryRaw<Array<{
          id: number;
          name: string;
          kind: FinancePaymentMethodKind;
          currency: string;
          currentBalance: Prisma.Decimal;
          active: boolean;
        }>>`
          SELECT id, name, kind, currency, "currentBalance", active
          FROM "finance_payment_methods"
          WHERE id = ${input.targetMethodId}
          FOR UPDATE
        `;
        const target = targetRows[0];
        if (!target) {
          throw new TransferOperationError(
            'TRANSFER_TARGET_NOT_FOUND',
            404,
            'El medio de destino no existe',
          );
        }
        if (!target.active) {
          throw new TransferOperationError(
            'TRANSFER_TARGET_INACTIVE',
            409,
            'El medio de destino está inactivo',
          );
        }

        // ─── 3) Validaciones ────────────────────────────────────────────
        if (source.id === target.id) {
          throw new TransferOperationError(
            'TRANSFER_SAME_METHOD',
            400,
            'Origen y destino deben ser distintos',
          );
        }
        if (source.currency !== target.currency) {
          throw new TransferOperationError(
            'TRANSFER_CURRENCY_MISMATCH',
            400,
            'Origen y destino deben tener la misma moneda',
            { sourceCurrency: source.currency, targetCurrency: target.currency },
          );
        }
        if (source.currentBalance.lt(amount)) {
          throw new TransferOperationError(
            'TRANSFER_INSUFFICIENT_BALANCE',
            409,
            'Saldo insuficiente en el medio de origen',
            {
              available: money(source.currentBalance),
              requested: money(amount),
              shortfall: money(amount.sub(source.currentBalance)),
            },
          );
        }

        // ─── 4) Updates atómicos ────────────────────────────────────────
        await tx.financePaymentMethod.update({
          where: { id: source.id },
          data: { currentBalance: { decrement: amount } },
        });
        await tx.financePaymentMethod.update({
          where: { id: target.id },
          data: { currentBalance: { increment: amount } },
        });

        // ─── 5) Crear el registro ───────────────────────────────────────
        const row = await tx.financeTransfer.create({
          data: {
            occurredAt,
            sourceMethodId: source.id,
            targetMethodId: target.id,
            amount,
            currency: source.currency,
            description: input.description,
            documentNumber: input.documentNumber ?? null,
            createdById: actorId,
          },
        });
        return toTransferRow(row);
      });
    },

    async findTransferById(id) {
      const row = await client.financeTransfer.findUnique({ where: { id } });
      return row ? toTransferRow(row) : null;
    },

    async listTransfers(filter) {
      const rows = await client.financeTransfer.findMany({
        where: buildWhere(filter),
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 500,
      });
      return rows.map(toTransferRow);
    },

    async listMethods() {
      const rows = await client.financePaymentMethod.findMany({
        where: { active: true },
        orderBy: [{ kind: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, kind: true, currency: true, currentBalance: true },
      });
      return rows;
    },
  };
}

// ─── Contrato de salida ────────────────────────────────────────────────────

export type TransferDto = ReturnType<typeof serializeTransfer>;

// ─── Funciones públicas ────────────────────────────────────────────────────

async function serializeWithMethods(
  row: TransferRow,
  source: TransferDataSource,
): Promise<TransferDto> {
  const methods = await source.listMethods();
  const methodMap = new Map(methods.map(m => [m.id, m]));
  return serializeTransfer(
    row,
    methodMap.get(row.sourceMethodId) ?? null,
    methodMap.get(row.targetMethodId) ?? null,
  );
}

export async function createTransfer(
  input: CreateTransferInput,
  actorId: number,
  source: TransferDataSource = createPrismaTransferDataSource(),
): Promise<TransferDto> {
  // Defensa en profundidad (Zod ya lo valida)
  if (input.sourceMethodId === input.targetMethodId) {
    throw new TransferOperationError(
      'TRANSFER_SAME_METHOD',
      400,
      'Origen y destino deben ser distintos',
    );
  }
  if (new Prisma.Decimal(input.amount).lte(0)) {
    throw new TransferOperationError(
      'INVALID_AMOUNT',
      400,
      'El importe debe ser mayor a 0',
    );
  }
  const row = await source.executeTransfer(input, actorId);
  return serializeWithMethods(row, source);
}

export async function getTransfer(
  id: number,
  source: TransferDataSource = createPrismaTransferDataSource(),
): Promise<TransferDto> {
  const row = await source.findTransferById(id);
  if (!row) {
    throw new TransferOperationError('TRANSFER_NOT_FOUND', 404, 'Transferencia no encontrada');
  }
  return serializeWithMethods(row, source);
}

export async function listTransfers(
  query: ListTransfersQuery,
  source: TransferDataSource = createPrismaTransferDataSource(),
): Promise<TransferDto[]> {
  const filter: TransferFilter = {
    ...(query.from ? { from: bogotaStart(query.from) } : {}),
    ...(query.to ? { to: bogotaStart(addDays(query.to, 1)) } : {}),
    ...(query.sourceMethodId ? { sourceMethodId: query.sourceMethodId } : {}),
    ...(query.targetMethodId ? { targetMethodId: query.targetMethodId } : {}),
    ...(query.search ? { search: query.search } : {}),
  };
  const [rows, methods] = await Promise.all([
    source.listTransfers(filter),
    source.listMethods(),
  ]);
  const methodMap = new Map(methods.map(m => [m.id, m]));
  return rows.map(row => serializeTransfer(
    row,
    methodMap.get(row.sourceMethodId) ?? null,
    methodMap.get(row.targetMethodId) ?? null,
  ));
}

export async function getTransferReferences(
  source: TransferDataSource = createPrismaTransferDataSource(),
) {
  const methods = await source.listMethods();
  return {
    paymentMethods: methods.map(m => ({
      id: m.id,
      name: m.name,
      kind: m.kind,
      currency: m.currency,
      currentBalance: money(m.currentBalance),
    })),
  };
}