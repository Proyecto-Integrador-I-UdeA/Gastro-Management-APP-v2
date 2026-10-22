import { describe, expect, it } from 'vitest';
import { FinancePaymentMethodKind, Prisma } from '@prisma/client';
import type {
  MethodRow,
  TransferDataSource,
  TransferFilter,
  TransferRow,
} from '../../../src/services/finance/transferService';
import {
  createTransfer,
  TransferOperationError,
} from '../../../src/services/finance/transferService';
import type { CreateTransferInput } from '../../../src/schemas/finance/transferSchema';

// ─── Fake in-memory data source ────────────────────────────────────────────

type FakeSource = {
  source: TransferDataSource;
  getMethod(id: number): MethodRow | undefined;
  getTransfers(): TransferRow[];
};

function fakeSource(
  initialMethods: MethodRow[],
  initialTransfers: TransferRow[] = [],
): FakeSource {
  const methods = new Map(initialMethods.map(m => [m.id, { ...m }]));
  const transfers: TransferRow[] = [...initialTransfers];
  let nextId = transfers.length + 1;

  const source: TransferDataSource = {
    async executeTransfer(input, actorId) {
      const src = methods.get(input.sourceMethodId);
      const tgt = methods.get(input.targetMethodId);
      if (!src) {
        throw new TransferOperationError('TRANSFER_SOURCE_NOT_FOUND', 404, 'El medio de origen no existe');
      }
      if (!tgt) {
        throw new TransferOperationError('TRANSFER_TARGET_NOT_FOUND', 404, 'El medio de destino no existe');
      }
      if (src.id === tgt.id) {
        throw new TransferOperationError('TRANSFER_SAME_METHOD', 400, 'Origen y destino deben ser distintos');
      }
      if (src.currency !== tgt.currency) {
        throw new TransferOperationError('TRANSFER_CURRENCY_MISMATCH', 400, 'Origen y destino deben tener la misma moneda');
      }
      const amount = new Prisma.Decimal(input.amount);
      if (src.currentBalance.lt(amount)) {
        throw new TransferOperationError(
          'TRANSFER_INSUFFICIENT_BALANCE',
          409,
          'Saldo insuficiente en el medio de origen',
          {
            available: src.currentBalance.toFixed(2),
            requested: amount.toFixed(2),
          },
        );
      }
      src.currentBalance = src.currentBalance.sub(amount);
      tgt.currentBalance = tgt.currentBalance.add(amount);
      const row: TransferRow = {
        id: nextId++,
        occurredAt: new Date(`${input.occurredAt}T00:00:00.000-05:00`),
        sourceMethodId: input.sourceMethodId,
        targetMethodId: input.targetMethodId,
        amount,
        currency: src.currency,
        description: input.description,
        documentNumber: input.documentNumber ?? null,
        createdById: actorId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      transfers.push(row);
      return row;
    },

    async findTransferById(id) {
      return transfers.find(t => t.id === id) ?? null;
    },

    async listTransfers(filter: TransferFilter) {
      return transfers.filter(t => {
        if (filter.from && t.occurredAt < filter.from) return false;
        if (filter.to && t.occurredAt >= filter.to) return false;
        if (filter.sourceMethodId && t.sourceMethodId !== filter.sourceMethodId) return false;
        if (filter.targetMethodId && t.targetMethodId !== filter.targetMethodId) return false;
        if (filter.search) {
          const q = filter.search.toLowerCase();
          const descMatch = t.description.toLowerCase().includes(q);
          const docMatch = (t.documentNumber ?? '').toLowerCase().includes(q);
          if (!descMatch && !docMatch) return false;
        }
        return true;
      });
    },

    async listMethods() {
      return [...methods.values()];
    },
  };

  return {
    source,
    getMethod: id => methods.get(id),
    getTransfers: () => transfers,
  };
}

// ─── Fixtures ──────────────────────────────────────────────────────────────

function method(overrides: Partial<MethodRow> = {}): MethodRow {
  return {
    id: 1,
    name: 'Caja',
    kind: FinancePaymentMethodKind.CASH,
    currency: 'COP',
    currentBalance: new Prisma.Decimal(1000),
    ...overrides,
  };
}

const baseInput: CreateTransferInput = {
  occurredAt: '2026-03-15',
  sourceMethodId: 1,
  targetMethodId: 2,
  amount: '300.00',
  description: 'Traslado a banco',
  documentNumber: null,
};

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('transferService · createTransfer (happy path)', () => {
  it('resta en origen + suma en destino + devuelve DTO correcto', async () => {
    const fake = fakeSource([
      method({ id: 1, name: 'Caja', currentBalance: new Prisma.Decimal(1000) }),
      method({ id: 2, name: 'Banco', kind: FinancePaymentMethodKind.BANK, currentBalance: new Prisma.Decimal(500) }),
    ]);

    const dto = await createTransfer(baseInput, 99, fake.source);

    expect(dto.amount).toBe('300.00');
    expect(dto.currency).toBe('COP');
    expect(dto.sourceMethod?.id).toBe(1);
    expect(dto.sourceMethod?.currentBalance).toBe('700.00'); // 1000 - 300
    expect(dto.targetMethod?.id).toBe(2);
    expect(dto.targetMethod?.currentBalance).toBe('800.00'); // 500 + 300
    expect(dto.createdById).toBe(99);

    // Verify state in fake
    expect(fake.getMethod(1)?.currentBalance.toFixed(2)).toBe('700.00');
    expect(fake.getMethod(2)?.currentBalance.toFixed(2)).toBe('800.00');
    expect(fake.getTransfers()).toHaveLength(1);
  });

  it('registra documentNumber cuando se provee', async () => {
    const fake = fakeSource([
      method({ id: 1, currentBalance: new Prisma.Decimal(1000) }),
      method({ id: 2, kind: FinancePaymentMethodKind.BANK }),
    ]);

    const dto = await createTransfer(
      { ...baseInput, documentNumber: 'TRF-001' },
      1,
      fake.source,
    );

    expect(dto.documentNumber).toBe('TRF-001');
  });

  it('permite saldo resultante exactamente 0 en origen', async () => {
    const fake = fakeSource([
      method({ id: 1, currentBalance: new Prisma.Decimal(300) }),
      method({ id: 2, kind: FinancePaymentMethodKind.BANK, currentBalance: new Prisma.Decimal(0) }),
    ]);

    const dto = await createTransfer(
      { ...baseInput, amount: '300.00' },
      1,
      fake.source,
    );

    expect(dto.sourceMethod?.currentBalance).toBe('0.00');
    expect(dto.targetMethod?.currentBalance).toBe('300.00');
  });
});

describe('transferService · createTransfer (validaciones)', () => {
  it('rechaza source === target', async () => {
    const fake = fakeSource([method({ id: 1 })]);
    await expect(
      createTransfer({ ...baseInput, sourceMethodId: 1, targetMethodId: 1 }, 1, fake.source),
    ).rejects.toMatchObject({ code: 'TRANSFER_SAME_METHOD', statusCode: 400 });
  });

  it('rechaza amount ≤ 0 con INVALID_AMOUNT (defensa en profundidad)', async () => {
    const fake = fakeSource([method({ id: 1 }), method({ id: 2 })]);
    await expect(
      createTransfer({ ...baseInput, amount: '0' }, 1, fake.source),
    ).rejects.toMatchObject({ code: 'INVALID_AMOUNT', statusCode: 400 });
  });

  it('rechaza saldo insuficiente con detalle', async () => {
    const fake = fakeSource([
      method({ id: 1, currentBalance: new Prisma.Decimal(100) }),
      method({ id: 2, kind: FinancePaymentMethodKind.BANK }),
    ]);

    await expect(
      createTransfer({ ...baseInput, amount: '300.00' }, 1, fake.source),
    ).rejects.toMatchObject({
      code: 'TRANSFER_INSUFFICIENT_BALANCE',
      statusCode: 409,
      details: { available: '100.00', requested: '300.00' },
    });

    // Los saldos NO deben haber cambiado (rollback del fake)
    expect(fake.getMethod(1)?.currentBalance.toFixed(2)).toBe('100.00');
    expect(fake.getMethod(2)?.currentBalance.toFixed(2)).toBe('1000.00');
    expect(fake.getTransfers()).toHaveLength(0);
  });

  it('rechaza source inexistente', async () => {
    const fake = fakeSource([method({ id: 2, kind: FinancePaymentMethodKind.BANK })]);
    await expect(
      createTransfer({ ...baseInput, sourceMethodId: 99, targetMethodId: 2 }, 1, fake.source),
    ).rejects.toMatchObject({ code: 'TRANSFER_SOURCE_NOT_FOUND', statusCode: 404 });
  });

  it('rechaza target inexistente', async () => {
    const fake = fakeSource([method({ id: 1 })]);
    await expect(
      createTransfer({ ...baseInput, sourceMethodId: 1, targetMethodId: 99 }, 1, fake.source),
    ).rejects.toMatchObject({ code: 'TRANSFER_TARGET_NOT_FOUND', statusCode: 404 });
  });

  it('rechaza moneda distinta entre origen y destino', async () => {
    const fake = fakeSource([
      method({ id: 1, currency: 'COP' }),
      method({ id: 2, kind: FinancePaymentMethodKind.BANK, currency: 'USD' }),
    ]);

    await expect(
      createTransfer(baseInput, 1, fake.source),
    ).rejects.toMatchObject({
      code: 'TRANSFER_CURRENCY_MISMATCH',
      statusCode: 400,
    });
  });
});

describe('transferService · listTransfers', () => {
  it('filtra por rango de fechas', async () => {
    const fake = fakeSource(
      [
        method({ id: 1, name: 'Caja', currentBalance: new Prisma.Decimal(10000) }),
        method({ id: 2, name: 'Banco', kind: FinancePaymentMethodKind.BANK, currentBalance: new Prisma.Decimal(10000) }),
      ],
      [
        {
          id: 1,
          occurredAt: new Date('2026-03-10T12:00:00.000-05:00'),
          sourceMethodId: 1,
          targetMethodId: 2,
          amount: new Prisma.Decimal(100),
          currency: 'COP',
          description: 'Transfer 10 marzo',
          documentNumber: null,
          createdById: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          occurredAt: new Date('2026-03-20T12:00:00.000-05:00'),
          sourceMethodId: 1,
          targetMethodId: 2,
          amount: new Prisma.Decimal(200),
          currency: 'COP',
          description: 'Transfer 20 marzo',
          documentNumber: null,
          createdById: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    );

    const { listTransfers } = await import('../../../src/services/finance/transferService');
    const results = await listTransfers({ from: '2026-03-15', to: '2026-03-25' }, fake.source);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(2);
  });

  it('busca por descripción', async () => {
    const fake = fakeSource(
      [
        method({ id: 1, currentBalance: new Prisma.Decimal(10000) }),
        method({ id: 2, kind: FinancePaymentMethodKind.BANK, currentBalance: new Prisma.Decimal(10000) }),
      ],
      [
        {
          id: 1,
          occurredAt: new Date('2026-03-10T12:00:00.000-05:00'),
          sourceMethodId: 1,
          targetMethodId: 2,
          amount: new Prisma.Decimal(100),
          currency: 'COP',
          description: 'Traslado a banco',
          documentNumber: null,
          createdById: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          occurredAt: new Date('2026-03-20T12:00:00.000-05:00'),
          sourceMethodId: 1,
          targetMethodId: 2,
          amount: new Prisma.Decimal(200),
          currency: 'COP',
          description: 'Pago proveedor',
          documentNumber: 'TRF-002',
          createdById: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    );

    const { listTransfers } = await import('../../../src/services/finance/transferService');
    const results = await listTransfers({ search: 'proveedor' }, fake.source);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(2);
  });

  it('sin coincidencias → array vacío', async () => {
    const fake = fakeSource([
      method({ id: 1 }),
      method({ id: 2, kind: FinancePaymentMethodKind.BANK }),
    ]);
    const { listTransfers } = await import('../../../src/services/finance/transferService');
    const results = await listTransfers({ search: 'no-existe' }, fake.source);
    expect(results).toEqual([]);
  });
});