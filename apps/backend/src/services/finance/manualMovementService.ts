import {
  FinanceCounterpartyKind,
  FinanceMovementKind,
  FinanceMovementStatus,
  FinancePaymentMethodKind,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import prisma from '../../lib/prisma';
import type {
  CreateManualMovementInput,
  ListManualMovementsQuery,
  ManualMovementSummaryQuery,
  UpdateManualMovementInput,
} from '../../schemas/finance/manualMovementSchema';

// ─── Tipos internos ────────────────────────────────────────────────────────

type MovementClient = PrismaClient | Prisma.TransactionClient;

export type MovementRow = {
  id: number;
  kind: FinanceMovementKind;
  status: FinanceMovementStatus;
  occurredAt: Date;
  concept: string;
  amount: Prisma.Decimal;
  currency: string;
  documentNumber: string | null;
  counterpartyId: number | null;
  paymentMethodId: number;
  createdById: number;
  cancelledById: number | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CounterpartyRow = {
  id: number;
  name: string;
  kind: FinanceCounterpartyKind;
  taxId: string | null;
};

export type PaymentMethodRow = {
  id: number;
  name: string;
  kind: FinancePaymentMethodKind;
  currency: string;
  currentBalance: Prisma.Decimal;
};

export type MovementFilter = {
  from?: Date;
  to?: Date;
  kind?: FinanceMovementKind;
  status?: FinanceMovementStatus;
  paymentMethodId?: number;
  search?: string;
};

export type MovementAggregate = {
  income: Prisma.Decimal;
  expense: Prisma.Decimal;
  pendingCount: number;
};

export type MovementOperation =
  | { type: 'CREATE'; input: CreateManualMovementInput; actorId: number }
  | { type: 'UPDATE'; id: number; input: UpdateManualMovementInput; actorId: number }
  | { type: 'CANCEL'; id: number; reason: string; actorId: number }
  | { type: 'CONFIRM'; id: number; actorId: number };

export interface ManualMovementDataSource {
  listCounterparties(): Promise<CounterpartyRow[]>;
  listPaymentMethods(): Promise<PaymentMethodRow[]>;
  findMovementById(id: number): Promise<MovementRow | null>;
  listMovements(filter: MovementFilter): Promise<MovementRow[]>;
  aggregateMovements(filter: MovementFilter): Promise<MovementAggregate>;
  executeOperation(operation: MovementOperation): Promise<MovementRow>;
}

// ─── Errores ───────────────────────────────────────────────────────────────

export class ManualMovementOperationError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ManualMovementOperationError';
  }
}

// ─── Utilidades ────────────────────────────────────────────────────────────

const ZERO = new Prisma.Decimal(0);
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

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

function todayInBogota(): string {
  return new Date(Date.now() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

function monthBounds(ymd: string): { from: string; to: string } {
  const yearMonth = ymd.slice(0, 7);
  const from = `${yearMonth}-01`;
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

// ─── Serialización ─────────────────────────────────────────────────────────

function serializeMovement(
  row: MovementRow,
  counterparty: CounterpartyRow | null,
  paymentMethod: PaymentMethodRow | null,
) {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    occurredAt: row.occurredAt.toISOString(),
    concept: row.concept,
    amount: money(row.amount),
    currency: row.currency,
    documentNumber: row.documentNumber,
    counterparty: counterparty
      ? { id: counterparty.id, name: counterparty.name, kind: counterparty.kind }
      : null,
    paymentMethod: paymentMethod
      ? { id: paymentMethod.id, name: paymentMethod.name, kind: paymentMethod.kind }
      : null,
    createdById: row.createdById,
    cancelledById: row.cancelledById,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancellationReason: row.cancellationReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── Data source Prisma ────────────────────────────────────────────────────

function buildWhere(filter: MovementFilter): Prisma.FinanceManualMovementWhereInput {
  const where: Prisma.FinanceManualMovementWhereInput = {};
  if (filter.from || filter.to) {
    where.occurredAt = {};
    if (filter.from) where.occurredAt.gte = filter.from;
    if (filter.to) where.occurredAt.lt = filter.to;
  }
  if (filter.kind) where.kind = filter.kind;
  if (filter.status) where.status = filter.status;
  if (filter.paymentMethodId) where.paymentMethodId = filter.paymentMethodId;
  if (filter.search && filter.search.trim()) {
    const q = filter.search.trim();
    where.OR = [
      { concept: { contains: q, mode: 'insensitive' } },
      { documentNumber: { contains: q, mode: 'insensitive' } },
      { counterparty: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }
  return where;
}

function toMovementRow(row: {
  id: number;
  kind: FinanceMovementKind;
  status: FinanceMovementStatus;
  occurredAt: Date;
  concept: string;
  amount: Prisma.Decimal;
  currency: string;
  documentNumber: string | null;
  counterpartyId: number | null;
  paymentMethodId: number;
  createdById: number;
  cancelledById: number | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}): MovementRow {
  return row;
}

async function adjustBalance(
  tx: Prisma.TransactionClient,
  paymentMethodId: number,
  delta: Prisma.Decimal,
): Promise<void> {
  if (delta.isZero()) return;
  await tx.financePaymentMethod.update({
    where: { id: paymentMethodId },
    data: {
      currentBalance: delta.gt(0)
        ? { increment: delta }
        : { decrement: delta.abs() },
    },
  });
}

function balanceDelta(kind: FinanceMovementKind, amount: Prisma.Decimal): Prisma.Decimal {
  return kind === FinanceMovementKind.INCOME ? amount : amount.neg();
}

export function createPrismaManualMovementDataSource(
  client: MovementClient = prisma,
): ManualMovementDataSource {
  return {
    async listCounterparties() {
      const rows = await client.financeCounterparty.findMany({
        where: { active: true },
        orderBy: [{ kind: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, kind: true, taxId: true },
      });
      return rows;
    },

    async listPaymentMethods() {
      const rows = await client.financePaymentMethod.findMany({
        where: { active: true },
        orderBy: [{ kind: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, kind: true, currency: true, currentBalance: true },
      });
      return rows;
    },

    async findMovementById(id) {
      const row = await client.financeManualMovement.findUnique({ where: { id } });
      return row ? toMovementRow(row) : null;
    },

    async listMovements(filter) {
      const rows = await client.financeManualMovement.findMany({
        where: buildWhere(filter),
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 500,
      });
      return rows.map(toMovementRow);
    },

    async aggregateMovements(filter) {
      const where = buildWhere(filter);
      const rows = await client.financeManualMovement.groupBy({
        by: ['kind', 'status'],
        where,
        _sum: { amount: true },
        _count: { _all: true },
      });
      let income = ZERO;
      let expense = ZERO;
      let pendingCount = 0;
      for (const row of rows) {
        if (row.status === FinanceMovementStatus.POSTED) {
          if (row.kind === FinanceMovementKind.INCOME && row._sum.amount) {
            income = income.add(row._sum.amount);
          } else if (row.kind === FinanceMovementKind.EXPENSE && row._sum.amount) {
            expense = expense.add(row._sum.amount);
          }
        } else if (row.status === FinanceMovementStatus.PENDING) {
          pendingCount += row._count._all;
        }
      }
      return { income, expense, pendingCount };
    },

    async executeOperation(operation) {
      return prisma.$transaction(async tx => {
        // ─── CREATE ─────────────────────────────────────────────────────
        if (operation.type === 'CREATE') {
          const amount = new Prisma.Decimal(operation.input.amount);
          const occurredAt = bogotaStart(operation.input.occurredAt);
          const status = operation.input.status === 'PENDING'
            ? FinanceMovementStatus.PENDING
            : FinanceMovementStatus.POSTED;
          const row = await tx.financeManualMovement.create({
            data: {
              kind: operation.input.kind,
              status,
              occurredAt,
              concept: operation.input.concept,
              amount,
              currency: operation.input.currency,
              documentNumber: operation.input.documentNumber ?? null,
              counterpartyId: operation.input.counterpartyId ?? null,
              paymentMethodId: operation.input.paymentMethodId,
              createdById: operation.actorId,
            },
          });
          // Solo POSTED mueve el saldo; PENDING no
          if (status === FinanceMovementStatus.POSTED) {
            await adjustBalance(tx, row.paymentMethodId, balanceDelta(row.kind, amount));
          }
          return toMovementRow(row);
        }

        // ─── UPDATE ─────────────────────────────────────────────────────
        if (operation.type === 'UPDATE') {
          const current = await tx.financeManualMovement.findUnique({
            where: { id: operation.id },
          });
          if (!current) {
            throw new ManualMovementOperationError('MOVEMENT_NOT_FOUND', 404, 'Movimiento no encontrado');
          }
          if (current.status !== FinanceMovementStatus.POSTED) {
            throw new ManualMovementOperationError(
              'MOVEMENT_NOT_EDITABLE',
              409,
              'Solo se pueden editar movimientos en estado POSTED',
            );
          }
          await adjustBalance(tx, current.paymentMethodId, balanceDelta(current.kind, current.amount.neg()));
          const nextKind = operation.input.kind ?? current.kind;
          const nextAmount = operation.input.amount
            ? new Prisma.Decimal(operation.input.amount)
            : current.amount;
          const nextPaymentMethodId = operation.input.paymentMethodId ?? current.paymentMethodId;
          const row = await tx.financeManualMovement.update({
            where: { id: operation.id },
            data: {
              ...(operation.input.kind !== undefined ? { kind: operation.input.kind } : {}),
              ...(operation.input.amount !== undefined ? { amount: nextAmount } : {}),
              ...(operation.input.occurredAt !== undefined
                ? { occurredAt: bogotaStart(operation.input.occurredAt) }
                : {}),
              ...(operation.input.concept !== undefined ? { concept: operation.input.concept } : {}),
              ...(operation.input.documentNumber !== undefined
                ? { documentNumber: operation.input.documentNumber }
                : {}),
              ...(operation.input.counterpartyId !== undefined
                ? { counterpartyId: operation.input.counterpartyId }
                : {}),
              ...(operation.input.paymentMethodId !== undefined
                ? { paymentMethodId: operation.input.paymentMethodId }
                : {}),
            },
          });
          await adjustBalance(tx, nextPaymentMethodId, balanceDelta(nextKind, nextAmount));
          return toMovementRow(row);
        }

        // ─── CONFIRM ────────────────────────────────────────────────────
        if (operation.type === 'CONFIRM') {
          const current = await tx.financeManualMovement.findUnique({
            where: { id: operation.id },
          });
          if (!current) {
            throw new ManualMovementOperationError('MOVEMENT_NOT_FOUND', 404, 'Movimiento no encontrado');
          }
          if (current.status === FinanceMovementStatus.POSTED) {
            return toMovementRow(current);
          }
          if (current.status !== FinanceMovementStatus.PENDING) {
            throw new ManualMovementOperationError(
              'MOVEMENT_NOT_CONFIRMABLE',
              409,
              'Solo se pueden confirmar movimientos en estado PENDING',
            );
          }
          const row = await tx.financeManualMovement.update({
            where: { id: operation.id },
            data: { status: FinanceMovementStatus.POSTED },
          });
          await adjustBalance(tx, row.paymentMethodId, balanceDelta(row.kind, row.amount));
          return toMovementRow(row);
        }

        // ─── CANCEL ─────────────────────────────────────────────────────
        const current = await tx.financeManualMovement.findUnique({
          where: { id: operation.id },
        });
        if (!current) {
          throw new ManualMovementOperationError('MOVEMENT_NOT_FOUND', 404, 'Movimiento no encontrado');
        }
        if (current.status === FinanceMovementStatus.CANCELLED) {
          return toMovementRow(current);
        }
        if (current.status !== FinanceMovementStatus.POSTED) {
          throw new ManualMovementOperationError(
            'MOVEMENT_NOT_CANCELLABLE',
            409,
            'Solo se pueden cancelar movimientos en estado POSTED',
          );
        }
        await adjustBalance(tx, current.paymentMethodId, balanceDelta(current.kind, current.amount.neg()));
        const row = await tx.financeManualMovement.update({
          where: { id: operation.id },
          data: {
            status: FinanceMovementStatus.CANCELLED,
            cancelledAt: new Date(),
            cancelledById: operation.actorId,
            cancellationReason: operation.reason,
          },
        });
        return toMovementRow(row);
      });
    },
  };
}

// ─── Contrato de salida ────────────────────────────────────────────────────

export type ManualMovementDto = ReturnType<typeof serializeMovement>;

export type ManualMovementSummaryResponse = {
  date: string;
  day: {
    income: string;
    expense: string;
    net: string;
    pendingCount: number;
  };
  month: {
    from: string;
    to: string;
    income: string;
    expense: string;
    net: string;
    pendingCount: number;
  };
  byPaymentMethod: Array<{
    id: number;
    name: string;
    kind: FinancePaymentMethodKind;
    currency: string;
    currentBalance: string;
    dayIncome: string;
    dayExpense: string;
    dayNet: string;
    monthIncome: string;
    monthExpense: string;
    monthNet: string;
  }>;
};

// ─── Funciones públicas ────────────────────────────────────────────────────

async function serializeWithRefs(
  row: MovementRow,
  source: ManualMovementDataSource,
): Promise<ManualMovementDto> {
  const [counterparties, methods] = await Promise.all([
    source.listCounterparties(),
    source.listPaymentMethods(),
  ]);
  const counterparty = row.counterpartyId !== null
    ? counterparties.find(c => c.id === row.counterpartyId) ?? null
    : null;
  const paymentMethod = methods.find(m => m.id === row.paymentMethodId) ?? null;
  return serializeMovement(row, counterparty, paymentMethod);
}

export async function createManualMovement(
  input: CreateManualMovementInput,
  actorId: number,
  source: ManualMovementDataSource = createPrismaManualMovementDataSource(),
): Promise<ManualMovementDto> {
  if (new Prisma.Decimal(input.amount).lte(0)) {
    throw new ManualMovementOperationError('INVALID_AMOUNT', 400, 'El importe debe ser mayor a 0');
  }
  const row = await source.executeOperation({ type: 'CREATE', input, actorId });
  return serializeWithRefs(row, source);
}

export async function updateManualMovement(
  id: number,
  input: UpdateManualMovementInput,
  actorId: number,
  source: ManualMovementDataSource = createPrismaManualMovementDataSource(),
): Promise<ManualMovementDto> {
  const row = await source.executeOperation({ type: 'UPDATE', id, input, actorId });
  return serializeWithRefs(row, source);
}

export async function cancelManualMovement(
  id: number,
  reason: string,
  actorId: number,
  source: ManualMovementDataSource = createPrismaManualMovementDataSource(),
): Promise<ManualMovementDto> {
  const row = await source.executeOperation({ type: 'CANCEL', id, reason, actorId });
  return serializeWithRefs(row, source);
}

export async function confirmManualMovement(
  id: number,
  actorId: number,
  source: ManualMovementDataSource = createPrismaManualMovementDataSource(),
): Promise<ManualMovementDto> {
  const row = await source.executeOperation({ type: 'CONFIRM', id, actorId });
  return serializeWithRefs(row, source);
}

export async function getManualMovement(
  id: number,
  source: ManualMovementDataSource = createPrismaManualMovementDataSource(),
): Promise<ManualMovementDto> {
  const row = await source.findMovementById(id);
  if (!row) {
    throw new ManualMovementOperationError('MOVEMENT_NOT_FOUND', 404, 'Movimiento no encontrado');
  }
  return serializeWithRefs(row, source);
}

export async function listManualMovements(
  query: ListManualMovementsQuery,
  source: ManualMovementDataSource = createPrismaManualMovementDataSource(),
): Promise<ManualMovementDto[]> {
  const filter: MovementFilter = {
    ...(query.from ? { from: bogotaStart(query.from) } : {}),
    ...(query.to ? { to: bogotaStart(addDays(query.to, 1)) } : {}),
    ...(query.kind ? { kind: query.kind } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.paymentMethodId ? { paymentMethodId: query.paymentMethodId } : {}),
    ...(query.search ? { search: query.search } : {}),
  };
  const [rows, counterparties, methods] = await Promise.all([
    source.listMovements(filter),
    source.listCounterparties(),
    source.listPaymentMethods(),
  ]);
  const counterpartyMap = new Map(counterparties.map(c => [c.id, c]));
  const methodMap = new Map(methods.map(m => [m.id, m]));
  return rows.map(row => serializeMovement(
    row,
    row.counterpartyId !== null ? counterpartyMap.get(row.counterpartyId) ?? null : null,
    methodMap.get(row.paymentMethodId) ?? null,
  ));
}

export async function getManualMovementSummary(
  query: ManualMovementSummaryQuery,
  source: ManualMovementDataSource = createPrismaManualMovementDataSource(),
): Promise<ManualMovementSummaryResponse> {
  const date = query.date ?? todayInBogota();
  const month = monthBounds(date);
  const dayFrom = bogotaStart(date);
  const dayTo = bogotaStart(addDays(date, 1));
  const monthFrom = bogotaStart(month.from);
  const monthTo = bogotaStart(addDays(month.to, 1));

  const [dayAgg, monthAgg, methods, dayMovs, monthMovs] = await Promise.all([
    source.aggregateMovements({ from: dayFrom, to: dayTo }),
    source.aggregateMovements({ from: monthFrom, to: monthTo }),
    source.listPaymentMethods(),
    source.listMovements({ from: dayFrom, to: dayTo, status: FinanceMovementStatus.POSTED }),
    source.listMovements({ from: monthFrom, to: monthTo, status: FinanceMovementStatus.POSTED }),
  ]);

  type Acc = { income: Prisma.Decimal; expense: Prisma.Decimal };
  const emptyAcc = (): Acc => ({ income: ZERO, expense: ZERO });
  const accDay = new Map<number, Acc>();
  const accMonth = new Map<number, Acc>();
  for (const row of dayMovs) {
    const current = accDay.get(row.paymentMethodId) ?? emptyAcc();
    if (row.kind === FinanceMovementKind.INCOME) current.income = current.income.add(row.amount);
    else current.expense = current.expense.add(row.amount);
    accDay.set(row.paymentMethodId, current);
  }
  for (const row of monthMovs) {
    const current = accMonth.get(row.paymentMethodId) ?? emptyAcc();
    if (row.kind === FinanceMovementKind.INCOME) current.income = current.income.add(row.amount);
    else current.expense = current.expense.add(row.amount);
    accMonth.set(row.paymentMethodId, current);
  }

  return {
    date,
    day: {
      income: money(dayAgg.income),
      expense: money(dayAgg.expense),
      net: money(dayAgg.income.sub(dayAgg.expense)),
      pendingCount: dayAgg.pendingCount,
    },
    month: {
      from: month.from,
      to: month.to,
      income: money(monthAgg.income),
      expense: money(monthAgg.expense),
      net: money(monthAgg.income.sub(monthAgg.expense)),
      pendingCount: monthAgg.pendingCount,
    },
    byPaymentMethod: methods.map(m => {
      const d = accDay.get(m.id) ?? emptyAcc();
      const mo = accMonth.get(m.id) ?? emptyAcc();
      return {
        id: m.id,
        name: m.name,
        kind: m.kind,
        currency: m.currency,
        currentBalance: money(m.currentBalance),
        dayIncome: money(d.income),
        dayExpense: money(d.expense),
        dayNet: money(d.income.sub(d.expense)),
        monthIncome: money(mo.income),
        monthExpense: money(mo.expense),
        monthNet: money(mo.income.sub(mo.expense)),
      };
    }),
  };
}

export async function getManualMovementReferences(
  source: ManualMovementDataSource = createPrismaManualMovementDataSource(),
) {
  const [counterparties, methods] = await Promise.all([
    source.listCounterparties(),
    source.listPaymentMethods(),
  ]);
  return {
    counterparties,
    paymentMethods: methods.map(m => ({
      id: m.id,
      name: m.name,
      kind: m.kind,
      currency: m.currency,
      currentBalance: money(m.currentBalance),
    })),
  };
}