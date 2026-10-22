import { describe, expect, it, vi } from 'vitest';
import {
  FinanceCounterpartyKind,
  FinanceMovementKind,
  FinanceMovementStatus,
  FinancePaymentMethodKind,
  Prisma,
} from '@prisma/client';
import type {
  CounterpartyRow,
  ManualMovementDataSource,
  MovementAggregate,
  MovementFilter,
  MovementOperation,
  MovementRow,
  PaymentMethodRow,
} from '../../../src/services/finance/manualMovementService';
import {
  cancelManualMovement,
  createManualMovement,
  getManualMovementSummary,
  listManualMovements,
} from '../../../src/services/finance/manualMovementService';

// ─── Helpers ───────────────────────────────────────────────────────────────

function fakeMovement(overrides: Partial<MovementRow> = {}): MovementRow {
  return {
    id: 1,
    kind: FinanceMovementKind.INCOME,
    status: FinanceMovementStatus.POSTED,
    occurredAt: new Date('2026-03-15T12:00:00.000-05:00'),
    concept: 'Venta catering',
    amount: new Prisma.Decimal(500),
    currency: 'COP',
    documentNumber: 'DOC-001',
    counterpartyId: 1,
    paymentMethodId: 1,
    createdById: 1,
    cancelledById: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: new Date('2026-03-15T12:00:00.000Z'),
    updatedAt: new Date('2026-03-15T12:00:00.000Z'),
    ...overrides,
  };
}

function counterparty(overrides: Partial<CounterpartyRow> = {}): CounterpartyRow {
  return {
    id: 1,
    name: 'Proveedor A',
    kind: FinanceCounterpartyKind.SUPPLIER,
    taxId: '123',
    ...overrides,
  };
}

function method(overrides: Partial<PaymentMethodRow> = {}): PaymentMethodRow {
  return {
    id: 1,
    name: 'Caja',
    kind: FinancePaymentMethodKind.CASH,
    currency: 'COP',
    currentBalance: new Prisma.Decimal(1000),
    ...overrides,
  };
}

type FakeSourceOptions = {
  movements?: MovementRow[];
  counterparties?: CounterpartyRow[];
  methods?: PaymentMethodRow[];
  operationResult?: MovementRow;
  operationCall?: (op: MovementOperation) => void;
  aggregateOverride?: (filter: MovementFilter) => MovementAggregate | null;
};

function fakeSource(opts: FakeSourceOptions = {}): ManualMovementDataSource {
  const movements = opts.movements ?? [];
  const counterparties = opts.counterparties ?? [counterparty()];
  const methods = opts.methods ?? [method()];
  return {
    listCounterparties: async () => counterparties,
    listPaymentMethods: async () => methods,
    findMovementById: async id => movements.find(m => m.id === id) ?? null,
    listMovements: async filter => {
      return movements.filter(m => {
        if (filter.from && m.occurredAt < filter.from) return false;
        if (filter.to && m.occurredAt >= filter.to) return false;
        if (filter.kind && m.kind !== filter.kind) return false;
        if (filter.status && m.status !== filter.status) return false;
        if (filter.paymentMethodId && m.paymentMethodId !== filter.paymentMethodId) return false;
        if (filter.search) {
          const q = filter.search.toLowerCase();
          const conceptMatch = m.concept.toLowerCase().includes(q);
          const docMatch = (m.documentNumber ?? '').toLowerCase().includes(q);
          const cp = counterparties.find(c => c.id === m.counterpartyId);
          const counterpartyMatch = cp ? cp.name.toLowerCase().includes(q) : false;
          if (!conceptMatch && !docMatch && !counterpartyMatch) return false;
        }
        return true;
      });
    },
    aggregateMovements: async filter => {
      if (opts.aggregateOverride) {
        const custom = opts.aggregateOverride(filter);
        if (custom) return custom;
      }
      let income = new Prisma.Decimal(0);
      let expense = new Prisma.Decimal(0);
      let pendingCount = 0;
      for (const m of movements) {
        if (filter.from && m.occurredAt < filter.from) continue;
        if (filter.to && m.occurredAt >= filter.to) continue;
        if (m.status === FinanceMovementStatus.POSTED) {
          if (m.kind === FinanceMovementKind.INCOME) income = income.add(m.amount);
          else expense = expense.add(m.amount);
        } else if (m.status === FinanceMovementStatus.PENDING) {
          pendingCount += 1;
        }
      }
      return { income, expense, pendingCount };
    },
    executeOperation: async op => {
      opts.operationCall?.(op);
      return opts.operationResult ?? fakeMovement();
    },
  };
}

// ─── createManualMovement ──────────────────────────────────────────────────

describe('manualMovementService · createManualMovement', () => {
  it('crea un movimiento INCOME y devuelve DTO con montos como string', async () => {
    let captured: MovementOperation | null = null;
    const source = fakeSource({
      operationResult: fakeMovement({ kind: FinanceMovementKind.INCOME, amount: new Prisma.Decimal(500) }),
      operationCall: op => { captured = op; },
    });
    const dto = await createManualMovement({
      kind: 'INCOME',
      occurredAt: '2026-03-15',
      concept: 'Venta catering',
      amount: '500.00',
      currency: 'COP',
      documentNumber: 'DOC-001',
      counterpartyId: 1,
      paymentMethodId: 1,
    }, 1, source);
    expect(captured).toEqual(expect.objectContaining({ type: 'CREATE', actorId: 1 }));
    expect(dto.amount).toBe('500.00');
    expect(dto.kind).toBe('INCOME');
    expect(dto.counterparty?.name).toBe('Proveedor A');
    expect(dto.paymentMethod?.name).toBe('Caja');
  });

  it('rechaza amount <= 0 con INVALID_AMOUNT', async () => {
    const source = fakeSource();
    await expect(
      createManualMovement({
        kind: 'EXPENSE',
        occurredAt: '2026-03-15',
        concept: 'X',
        amount: '0',
        currency: 'COP',
        documentNumber: null,
        counterpartyId: null,
        paymentMethodId: 1,
      }, 1, source),
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT', statusCode: 400 });
  });
});

// ─── cancelManualMovement ──────────────────────────────────────────────────

describe('manualMovementService · cancelManualMovement', () => {
  it('delega a executeOperation con tipo CANCEL y reason', async () => {
    let captured: MovementOperation | null = null;
    const source = fakeSource({
      operationResult: fakeMovement({ status: FinanceMovementStatus.CANCELLED }),
      operationCall: op => { captured = op; },
    });
    await cancelManualMovement(1, 'Error de captura', 99, source);
    expect(captured).toEqual({ type: 'CANCEL', id: 1, reason: 'Error de captura', actorId: 99 });
  });

  it('propaga MOVEMENT_NOT_FOUND del data source', async () => {
    const source: ManualMovementDataSource = {
      ...fakeSource(),
      executeOperation: vi.fn().mockRejectedValue(
        Object.assign(new Error('Movimiento no encontrado'), {
          name: 'ManualMovementOperationError',
          code: 'MOVEMENT_NOT_FOUND',
          statusCode: 404,
        }),
      ),
    };
    await expect(cancelManualMovement(999, 'x', 1, source)).rejects.toMatchObject({
      code: 'MOVEMENT_NOT_FOUND',
    });
  });
});

// ─── listManualMovements ──────────────────────────────────────────────────

describe('manualMovementService · listManualMovements', () => {
  it('filtra por concepto', async () => {
    const source = fakeSource({
      movements: [
        fakeMovement({ id: 1, concept: 'Alquiler de salón' }),
        fakeMovement({ id: 2, concept: 'Venta catering' }),
      ],
    });
    const rows = await listManualMovements({ search: 'alquiler' }, source);
    expect(rows).toHaveLength(1);
    expect(rows[0].concept).toBe('Alquiler de salón');
  });

  it('filtra por tercero (nombre del counterparty)', async () => {
    const source = fakeSource({
      counterparties: [
        counterparty({ id: 1, name: 'Proveedor A' }),
        counterparty({ id: 2, name: 'Cliente B' }),
      ],
      movements: [
        fakeMovement({ id: 1, counterpartyId: 1 }),
        fakeMovement({ id: 2, counterpartyId: 2 }),
      ],
    });
    const rows = await listManualMovements({ search: 'cliente' }, source);
    expect(rows).toHaveLength(1);
    expect(rows[0].counterparty?.name).toBe('Cliente B');
  });

  it('filtra por documento', async () => {
    const source = fakeSource({
      movements: [
        fakeMovement({ id: 1, documentNumber: 'FAC-001' }),
        fakeMovement({ id: 2, documentNumber: 'FAC-002' }),
      ],
    });
    const rows = await listManualMovements({ search: 'FAC-002' }, source);
    expect(rows).toHaveLength(1);
    expect(rows[0].documentNumber).toBe('FAC-002');
  });

  it('filtra por kind, status y paymentMethodId', async () => {
    const source = fakeSource({
      movements: [
        fakeMovement({ id: 1, kind: FinanceMovementKind.INCOME, paymentMethodId: 1 }),
        fakeMovement({ id: 2, kind: FinanceMovementKind.EXPENSE, paymentMethodId: 2 }),
        fakeMovement({ id: 3, kind: FinanceMovementKind.EXPENSE, status: FinanceMovementStatus.CANCELLED, paymentMethodId: 2 }),
      ],
      methods: [method({ id: 1, name: 'Caja' }), method({ id: 2, name: 'Banco' })],
    });
    const onlyExpenses = await listManualMovements({ kind: 'EXPENSE' }, source);
    expect(onlyExpenses).toHaveLength(2);
    const onlyPostedExpenses = await listManualMovements({ kind: 'EXPENSE', status: 'POSTED' }, source);
    expect(onlyPostedExpenses).toHaveLength(1);
    const onlyMethod2 = await listManualMovements({ paymentMethodId: 2 }, source);
    expect(onlyMethod2).toHaveLength(2);
  });
});

// ─── getManualMovementSummary ──────────────────────────────────────────────

describe('manualMovementService · getManualMovementSummary', () => {
  it('agrega ingresos, egresos, neto y pendientes del día y mes', async () => {
    const source = fakeSource({
      methods: [
        method({ id: 1, name: 'Caja', currentBalance: new Prisma.Decimal(1500) }),
        method({ id: 2, name: 'Banco', kind: FinancePaymentMethodKind.BANK, currentBalance: new Prisma.Decimal(3000) }),
      ],
      movements: [
        // Día de hoy (2026-03-15)
        fakeMovement({ id: 1, occurredAt: new Date('2026-03-15T10:00:00.000-05:00'), kind: FinanceMovementKind.INCOME, amount: new Prisma.Decimal(500), paymentMethodId: 1 }),
        fakeMovement({ id: 2, occurredAt: new Date('2026-03-15T14:00:00.000-05:00'), kind: FinanceMovementKind.EXPENSE, amount: new Prisma.Decimal(200), paymentMethodId: 2 }),
        fakeMovement({ id: 3, occurredAt: new Date('2026-03-15T15:00:00.000-05:00'), kind: FinanceMovementKind.EXPENSE, amount: new Prisma.Decimal(100), status: FinanceMovementStatus.PENDING, paymentMethodId: 1 }),
        // Días anteriores del mismo mes
        fakeMovement({ id: 4, occurredAt: new Date('2026-03-05T10:00:00.000-05:00'), kind: FinanceMovementKind.INCOME, amount: new Prisma.Decimal(1000), paymentMethodId: 1 }),
      ],
    });
    const result = await getManualMovementSummary({ date: '2026-03-15' }, source);
    expect(result.day.income).toBe('500.00');
    expect(result.day.expense).toBe('200.00');
    expect(result.day.net).toBe('300.00');
    expect(result.day.pendingCount).toBe(1);
    expect(result.month.income).toBe('1500.00');
    expect(result.month.expense).toBe('200.00');
    expect(result.month.net).toBe('1300.00');
    expect(result.byPaymentMethod).toHaveLength(2);
    const caja = result.byPaymentMethod.find(m => m.id === 1)!;
    const banco = result.byPaymentMethod.find(m => m.id === 2)!;
    expect(caja.dayIncome).toBe('500.00');
    expect(caja.dayExpense).toBe('0.00');
    expect(caja.monthIncome).toBe('1500.00');
    expect(banco.dayExpense).toBe('200.00');
    expect(banco.monthExpense).toBe('200.00');
  });

  it('día sin movimientos devuelve todos los campos en 0', async () => {
    const source = fakeSource({ methods: [method()] });
    const result = await getManualMovementSummary({ date: '2030-01-01' }, source);
    expect(result.day.income).toBe('0.00');
    expect(result.day.expense).toBe('0.00');
    expect(result.day.net).toBe('0.00');
    expect(result.day.pendingCount).toBe(0);
    expect(result.month.net).toBe('0.00');
  });
});