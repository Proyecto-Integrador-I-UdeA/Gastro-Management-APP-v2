import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import type {
  AccrualRow,
  CashRow,
  IncomeDataSource,
} from '../../../src/services/finance/incomeService';
import { getIncomeSummary } from '../../../src/services/finance/incomeService';

function fakeSource(accrualRows: AccrualRow[], cashRows: CashRow[]): IncomeDataSource {
  return {
    loadAccrualRows: async () => accrualRows,
    loadCashRows: async () => cashRows,
  };
}

function accrualRow(overrides: Partial<AccrualRow> = {}): AccrualRow {
  return {
    invoiceId: 1,
    orderId: 10,
    settledAt: new Date('2026-01-15T18:00:00.000-05:00'),
    currency: 'COP',
    salesAmount: new Prisma.Decimal(100),
    taxAmount: new Prisma.Decimal(8),
    serviceAmount: new Prisma.Decimal(10),
    totalAmount: new Prisma.Decimal(118),
    ...overrides,
  };
}

describe('incomeService.getIncomeSummary · accrual', () => {
  it('agrupa por moneda y por bucket mensual, con ticket promedio', async () => {
    const source = fakeSource([
      accrualRow({ invoiceId: 1, orderId: 10, salesAmount: new Prisma.Decimal(100), taxAmount: new Prisma.Decimal(8), serviceAmount: new Prisma.Decimal(10), totalAmount: new Prisma.Decimal(118) }),
      accrualRow({ invoiceId: 2, orderId: 11, settledAt: new Date('2026-02-10T20:00:00.000-05:00'), salesAmount: new Prisma.Decimal(200), taxAmount: new Prisma.Decimal(16), serviceAmount: new Prisma.Decimal(20), totalAmount: new Prisma.Decimal(236) }),
    ], []);

    const result = await getIncomeSummary(
      { from: '2026-01-01', to: '2026-02-28', recognition: 'accrual', granularity: 'month', includeService: false },
      source,
    );

    expect(result.currencies).toHaveLength(1);
    const cop = result.currencies[0];
    expect(cop.currency).toBe('COP');
    expect(cop.totals.salesAmount).toBe('300.00');
    expect(cop.totals.consumptionTaxAmount).toBe('24.00');
    expect(cop.totals.serviceAmount).toBe('30.00');
    expect(cop.totals.totalCollected).toBe('354.00');
    expect(cop.totals.orderCount).toBe(2);
    expect(cop.totals.avgTicket).toBe('150.00');
    expect(cop.totals.operationalIncome).toBe('300.00'); // includeService=false
    expect(cop.buckets).toEqual([
      { period: '2026-01', salesAmount: '100.00', orderCount: 1 },
      { period: '2026-02', salesAmount: '200.00', orderCount: 1 },
    ]);
    expect(cop.byPaymentMethod).toBeUndefined(); // accrual no tiene método
  });

  it('includeService=true suma propinas a operationalIncome sin alterar salesAmount', async () => {
    const source = fakeSource([accrualRow()], []);
    const result = await getIncomeSummary(
      { from: '2026-01-01', to: '2026-01-31', recognition: 'accrual', granularity: 'month', includeService: true },
      source,
    );
    expect(result.currencies[0].totals.salesAmount).toBe('100.00');
    expect(result.currencies[0].totals.serviceAmount).toBe('10.00');
    expect(result.currencies[0].totals.operationalIncome).toBe('110.00');
  });

  it('serie de buckets es continua y se rellena con ceros', async () => {
    const source = fakeSource([accrualRow()], []);
    const result = await getIncomeSummary(
      { from: '2026-01-01', to: '2026-03-31', recognition: 'accrual', granularity: 'month', includeService: false },
      source,
    );
    expect(result.currencies[0].buckets.map(b => b.period)).toEqual([
      '2026-01', '2026-02', '2026-03',
    ]);
    expect(result.currencies[0].buckets[1].salesAmount).toBe('0.00');
    expect(result.currencies[0].buckets[1].orderCount).toBe(0);
  });

  it('multi-moneda agrupa correctamente sin mezclar', async () => {
    const source = fakeSource([
      accrualRow({ currency: 'COP', salesAmount: new Prisma.Decimal(100) }),
      accrualRow({ invoiceId: 2, orderId: 11, currency: 'USD', salesAmount: new Prisma.Decimal(50) }),
    ], []);
    const result = await getIncomeSummary(
      { from: '2026-01-01', to: '2026-01-31', recognition: 'accrual', granularity: 'month', includeService: false },
      source,
    );
    expect(result.currencies.map(c => c.currency).sort()).toEqual(['COP', 'USD']);
    const usd = result.currencies.find(c => c.currency === 'USD')!;
    expect(usd.totals.salesAmount).toBe('50.00');
  });

  it('sin filas retorna currencies vacío', async () => {
    const source = fakeSource([], []);
    const result = await getIncomeSummary(
      { from: '2026-01-01', to: '2026-03-31', recognition: 'accrual', granularity: 'month', includeService: false },
      source,
    );
    expect(result.currencies).toEqual([]);
  });
});

describe('incomeService.getIncomeSummary · cash', () => {
  it('agrupa por método de pago y cuenta órdenes distintas', async () => {
    const cashRows: CashRow[] = [
      { paymentId: 1, orderId: 10, receivedAt: new Date('2026-01-15T18:00:00.000-05:00'), method: 'CASH', currency: 'COP', salesAmount: new Prisma.Decimal(50), taxAmount: new Prisma.Decimal(4), serviceAmount: new Prisma.Decimal(5), totalAmount: new Prisma.Decimal(59) },
      { paymentId: 2, orderId: 10, receivedAt: new Date('2026-01-15T18:05:00.000-05:00'), method: 'CARD', currency: 'COP', salesAmount: new Prisma.Decimal(50), taxAmount: new Prisma.Decimal(4), serviceAmount: new Prisma.Decimal(5), totalAmount: new Prisma.Decimal(59) },
      { paymentId: 3, orderId: 11, receivedAt: new Date('2026-01-16T20:00:00.000-05:00'), method: 'CASH', currency: 'COP', salesAmount: new Prisma.Decimal(100), taxAmount: new Prisma.Decimal(8), serviceAmount: new Prisma.Decimal(10), totalAmount: new Prisma.Decimal(118) },
    ];
    const source = fakeSource([], cashRows);

    const result = await getIncomeSummary(
      { from: '2026-01-01', to: '2026-01-31', recognition: 'cash', granularity: 'month', includeService: false },
      source,
    );

    const cop = result.currencies[0];
    expect(cop.totals.salesAmount).toBe('200.00');
    expect(cop.totals.orderCount).toBe(2); // orden 10 aparece dos veces pero cuenta 1
    expect(cop.totals.avgTicket).toBe('100.00');
    expect(cop.byPaymentMethod).toEqual({
      CASH: '177.00',
      CARD: '59.00',
      TRANSFER: '0.00',
      OTHER: '0.00',
    });
  });

  it('avgTicket = 0.00 cuando no hay órdenes', async () => {
    const source = fakeSource([], []);
    const result = await getIncomeSummary(
      { from: '2026-01-01', to: '2026-01-31', recognition: 'cash', granularity: 'month', includeService: false },
      source,
    );
    // sin filas no hay currency
    expect(result.currencies).toEqual([]);
  });
});

describe('incomeService.getIncomeSummary · granularidad', () => {
  const rows = [
    accrualRow({ orderId: 1, settledAt: new Date('2026-01-05T12:00:00.000-05:00'), salesAmount: new Prisma.Decimal(10) }),
    accrualRow({ orderId: 2, settledAt: new Date('2026-01-06T12:00:00.000-05:00'), salesAmount: new Prisma.Decimal(20) }),
    accrualRow({ orderId: 3, settledAt: new Date('2026-01-12T12:00:00.000-05:00'), salesAmount: new Prisma.Decimal(30) }),
  ];

  it('por día', async () => {
    const source = fakeSource(rows, []);
    const result = await getIncomeSummary(
      { from: '2026-01-05', to: '2026-01-12', recognition: 'accrual', granularity: 'day', includeService: false },
      source,
    );
    const buckets = result.currencies[0].buckets;
    expect(buckets.find(b => b.period === '2026-01-05')?.salesAmount).toBe('10.00');
    expect(buckets.find(b => b.period === '2026-01-06')?.salesAmount).toBe('20.00');
    expect(buckets.find(b => b.period === '2026-01-12')?.salesAmount).toBe('30.00');
  });

  it('por semana agrupa en el lunes', async () => {
    // 2026-01-05 es lunes; 2026-01-06 es martes → misma semana
    // 2026-01-12 es lunes → nueva semana
    const source = fakeSource(rows, []);
    const result = await getIncomeSummary(
      { from: '2026-01-05', to: '2026-01-12', recognition: 'accrual', granularity: 'week', includeService: false },
      source,
    );
    const buckets = result.currencies[0].buckets;
    expect(buckets.find(b => b.period === '2026-01-05')?.salesAmount).toBe('30.00');
    expect(buckets.find(b => b.period === '2026-01-12')?.salesAmount).toBe('30.00');
  });

  it('por año', async () => {
    const source = fakeSource(rows, []);
    const result = await getIncomeSummary(
      { from: '2026-01-01', to: '2026-12-31', recognition: 'accrual', granularity: 'year', includeService: false },
      source,
    );
    expect(result.currencies[0].buckets).toEqual([
      { period: '2026', salesAmount: '60.00', orderCount: 3 },
    ]);
  });
});