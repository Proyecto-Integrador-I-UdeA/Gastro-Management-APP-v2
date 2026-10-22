import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import type {
  CashPaymentRow,
  ClosedCashSessionRow,
  CogsRealRow,
  CogsTheoreticalRow,
  IncomeStatementDataSource,
  KitchenDispatchRow,
  OperationalCostRow,
  ReservationRow,
  RevenueRow,
  VolumeRow,
} from '../../../src/services/finance/incomeStatementService';
import { getIncomeStatementSummary } from '../../../src/services/finance/incomeStatementService';

function fakeSource(data: {
  revenue?: RevenueRow[];
  cogsTheoretical?: CogsTheoreticalRow[];
  cogsReal?: CogsRealRow[];
  operational?: OperationalCostRow[];
  cash?: CashPaymentRow[];
  closedSessions?: ClosedCashSessionRow[];
  dispatches?: KitchenDispatchRow[];
  reservations?: ReservationRow[];
  activeTables?: number;
  volume?: VolumeRow[];
}): IncomeStatementDataSource {
  return {
    loadRevenueRows: async () => data.revenue ?? [],
    loadCogsTheoreticalRows: async () => data.cogsTheoretical ?? [],
    loadCogsRealRows: async () => data.cogsReal ?? [],
    loadOperationalCosts: async () => data.operational ?? [],
    loadCashPaymentRows: async () => data.cash ?? [],
    loadClosedCashSessions: async () => data.closedSessions ?? [],
    loadKitchenDispatchRows: async () => data.dispatches ?? [],
    loadReservationRows: async () => data.reservations ?? [],
    countActiveTables: async () => data.activeTables ?? 0,
    loadVolumeRows: async () => data.volume ?? [],
  };
}

function rev(
  orderId: number,
  ymd: string,
  sales: number,
  tax = 0,
  service = 0,
  guests: number | null = null,
  currency = 'COP',
): RevenueRow {
  return {
    orderId,
    settledAt: new Date(`${ymd}T20:00:00.000-05:00`),
    currency,
    salesAmount: new Prisma.Decimal(sales),
    taxAmount: new Prisma.Decimal(tax),
    serviceAmount: new Prisma.Decimal(service),
    guestCount: guests,
  };
}

function cogsTheo(orderId: number, ymd: string, qty: number, unit: number, currency = 'COP'): CogsTheoreticalRow {
  return {
    orderId,
    settledAt: new Date(`${ymd}T20:00:00.000-05:00`),
    currency,
    quantity: qty,
    unitBaseCost: new Prisma.Decimal(unit),
  };
}

function cogsReal(orderId: number, ymd: string, amount: number, currency = 'COP'): CogsRealRow {
  return {
    orderId,
    settledAt: new Date(`${ymd}T20:00:00.000-05:00`),
    currency,
    totalCost: new Prisma.Decimal(amount),
  };
}

function op(month: string, fixed: number, variable: number, payroll: number): OperationalCostRow {
  return {
    month,
    fixedCosts: new Prisma.Decimal(fixed),
    variableCosts: new Prisma.Decimal(variable),
    payroll: new Prisma.Decimal(payroll),
  };
}

function cash(method: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER', amount: number, currency = 'COP'): CashPaymentRow {
  return { method, currency, amount: new Prisma.Decimal(amount) };
}

function dispatch(orderId: number, startMin: number, durationMin: number): KitchenDispatchRow {
  const dispatchedAt = new Date('2026-01-15T20:00:00.000-05:00');
  dispatchedAt.setMinutes(dispatchedAt.getMinutes() + startMin);
  const deliveredAt = new Date(dispatchedAt.getTime() + durationMin * 60_000);
  return { orderId, dispatchedAt, deliveredAt };
}

const defaultQuery = {
  from: '2026-01-01',
  to: '2026-01-31',
  granularity: 'month' as const,
};

// ─── P&L base ─────────────────────────────────────────────────────────────

describe('incomeStatementService · P&L básico', () => {
  it('suma sales + service en revenue.total (D1=A)', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-10', 1000, 80, 100)],
    });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    const cop = result.currencies[0];
    expect(cop.pnl.revenue.sales).toBe('1000.00');
    expect(cop.pnl.revenue.service).toBe('100.00');
    expect(cop.pnl.revenue.total).toBe('1100.00');
    expect(cop.pnl.revenue.consumptionTax).toBe('80.00');
  });

  it('gross profit = revenue.total - cogs.real', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-10', 1000, 0, 0)],
      cogsReal: [cogsReal(1, '2026-01-10', 300)],
    });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    expect(result.currencies[0].pnl.grossProfit).toBe('700.00');
  });

  it('operating profit = gross - operating expenses', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-10', 1000)],
      cogsReal: [cogsReal(1, '2026-01-10', 300)],
      operational: [op('2026-01', 200, 100, 500)],
    });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    expect(result.currencies[0].pnl.operatingExpenses.total).toBe('800.00');
    expect(result.currencies[0].pnl.operatingProfit).toBe('-100.00');
    expect(result.currencies[0].pnl.netProfit).toBe('-100.00');
  });

  it('hasData=false si no hay other_costs', async () => {
    const source = fakeSource({ revenue: [rev(1, '2026-01-10', 500)] });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    expect(result.currencies[0].pnl.operatingExpenses.hasData).toBe(false);
    expect(result.currencies[0].pnl.operatingExpenses.total).toBe('0.00');
  });
});

// ─── KPIs: márgenes ───────────────────────────────────────────────────────

describe('incomeStatementService · KPIs márgenes', () => {
  it('calcula gross margin, operating margin, food cost, prime cost, waste %', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-10', 1000)],
      cogsReal: [cogsReal(1, '2026-01-10', 300)],
      cogsTheoretical: [cogsTheo(1, '2026-01-10', 1, 280)],
      operational: [op('2026-01', 100, 50, 400)],
    });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    const m = result.currencies[0].kpis.margins;
    expect(m.grossMarginPct).toBe('70.00');        // (1000-300)/1000
    expect(m.operatingMarginPct).toBe('15.00');    // (700-550)/1000
    expect(m.netMarginPct).toBe('15.00');
    expect(m.foodCostPct).toBe('30.00');           // 300/1000
    expect(m.primeCostPct).toBe('70.00');          // (300+400)/1000
    expect(m.wastePct).toBe('7.14');               // (300-280)/280
  });

  it('food cost = 0 si revenue = 0', async () => {
    const source = fakeSource({ cogsReal: [cogsReal(1, '2026-01-10', 100)] });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    expect(result.currencies[0].kpis.margins.foodCostPct).toBe('0.00');
  });
});

// ─── KPIs: estructura de costos ───────────────────────────────────────────

describe('incomeStatementService · KPIs estructura de costos', () => {
  it('labor/rent/variable/total cost %', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-10', 1000)],
      cogsReal: [cogsReal(1, '2026-01-10', 200)],
      operational: [op('2026-01', 150, 50, 400)],
    });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    const c = result.currencies[0].kpis.costStructure;
    expect(c.laborCostPct).toBe('40.00');          // 400/1000
    expect(c.rentCostPct).toBe('15.00');           // 150/1000
    expect(c.variableCostPct).toBe('5.00');        // 50/1000
    expect(c.totalCostPct).toBe('80.00');          // (200+600)/1000
  });
});

// ─── KPIs: break-even ─────────────────────────────────────────────────────

describe('incomeStatementService · KPIs break-even', () => {
    it('calcula break-even correctamente cuando hay margen positivo', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-10', 1000), rev(2, '2026-01-20', 500)],
      cogsReal: [cogsReal(1, '2026-01-10', 300), cogsReal(2, '2026-01-20', 150)],
      operational: [op('2026-01', 300, 0, 0)],
    });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    const be = result.currencies[0].kpis.breakEven;
    // Revenue 1500, COGS 450, Gross 1050, GrossMargin = 1050/1500 = 0.70
    // Break-even = fixedCosts / grossMargin = 300 / 0.70 = 428.57
    expect(be.feasible).toBe(true);
    expect(be.revenue).toBe('428.57');
    // avgTicket = 1500 / 2 = 750
    // breakEvenOrders = 428.57 / 750 = 0.57
    expect(be.orders).toBe('0.57');
    // marginOfSafety = (1500 - 428.57) / 1500 = 71.43%
    expect(be.marginOfSafetyPct).toBe('71.43');
  });

  it('feasible=false si grossMargin <= 0', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-10', 100)],
      cogsReal: [cogsReal(1, '2026-01-10', 200)],
      operational: [op('2026-01', 100, 0, 0)],
    });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    expect(result.currencies[0].kpis.breakEven.feasible).toBe(false);
    expect(result.currencies[0].kpis.breakEven.revenue).toBe('0.00');
  });

  it('feasible=false si fixedCosts = 0', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-10', 1000)],
      cogsReal: [cogsReal(1, '2026-01-10', 300)],
      // sin other_costs
    });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    expect(result.currencies[0].kpis.breakEven.feasible).toBe(false);
  });
});

// ─── KPIs: volumen ────────────────────────────────────────────────────────

describe('incomeStatementService · KPIs volumen', () => {
  it('orderCount, avgTicket, unitsSold', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-10', 500), rev(2, '2026-01-20', 700)],
      volume: [
        { orderId: 1, unitsSold: 3 },
        { orderId: 2, unitsSold: 5 },
      ],
    });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    const v = result.currencies[0].kpis.volume;
    expect(v.orderCount).toBe(2);
    expect(v.avgTicket).toBe('600.00');
    expect(v.unitsSold).toBe(8);
  });

  it('guests: hasGuestData=true cuando hay guestCount', async () => {
    const source = fakeSource({
      revenue: [
        rev(1, '2026-01-10', 500, 0, 0, 3),
        rev(2, '2026-01-20', 700, 0, 0, 4),
      ],
    });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    const v = result.currencies[0].kpis.volume;
    expect(v.hasGuestData).toBe(true);
    expect(v.totalGuests).toBe(7);
    expect(v.avgGuestsPerOrder).toBe('3.50');
    expect(v.revenuePerGuest).toBe('171.43');      // 1200/7
  });

  it('guests: hasGuestData=false cuando guestCount = null', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-10', 500, 0, 0, null)],
    });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    expect(result.currencies[0].kpis.volume.hasGuestData).toBe(false);
    expect(result.currencies[0].kpis.volume.totalGuests).toBe(0);
  });
});

// ─── KPIs: operaciones ────────────────────────────────────────────────────

describe('incomeStatementService · KPIs operaciones', () => {
  it('tableTurnover = orderCount / activeTables', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-10', 500), rev(2, '2026-01-20', 700), rev(3, '2026-01-25', 300)],
      activeTables: 3,
    });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    expect(result.currencies[0].kpis.operations.tableTurnover).toBe('1.00');
  });

  it('tableTurnover = 0 si no hay mesas', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-10', 500)],
      activeTables: 0,
    });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    expect(result.currencies[0].kpis.operations.tableTurnover).toBe('0.00');
  });

  it('avgKitchenTimeMinutes calcula promedio de dispatches', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-15', 500)],
      dispatches: [
        dispatch(1, 0, 15),
        dispatch(1, 30, 20),
        dispatch(1, 60, 25),
      ],
    });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    expect(result.currencies[0].kpis.operations.hasDispatchData).toBe(true);
    expect(result.currencies[0].kpis.operations.avgKitchenTimeMinutes).toBe(20);
  });

  it('avgKitchenTimeMinutes = null si no hay dispatches', async () => {
    const source = fakeSource({ revenue: [rev(1, '2026-01-15', 500)] });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    expect(result.currencies[0].kpis.operations.hasDispatchData).toBe(false);
    expect(result.currencies[0].kpis.operations.avgKitchenTimeMinutes).toBeNull();
  });

  it('reservationCompletionRatePct = completed / (completed + cancelled)', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-10', 500)],
      reservations: [
        { status: 'COMPLETED' as const },
        { status: 'COMPLETED' as const },
        { status: 'COMPLETED' as const },
        { status: 'CANCELLED' as const },
        { status: 'PENDING' as const },
        { status: 'CONFIRMED' as const },
      ],
    });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    const ops = result.currencies[0].kpis.operations;
    expect(ops.totalReservations).toBe(6);
    // 3 completadas / (3 + 1 cerradas) = 75%
    expect(ops.reservationCompletionRatePct).toBe('75.00');
  });

  it('reservationCompletionRatePct = null si no hay reservas cerradas', async () => {
    const source = fakeSource({ revenue: [rev(1, '2026-01-10', 500)] });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    expect(result.currencies[0].kpis.operations.reservationCompletionRatePct).toBeNull();
  });
});

// ─── KPIs: cash ───────────────────────────────────────────────────────────

describe('incomeStatementService · KPIs cash', () => {
  it('desglose por método y cash ratio', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-10', 500)],
      cash: [
        cash('CASH', 200),
        cash('CARD', 150),
        cash('TRANSFER', 100),
        cash('CASH', 50),
      ],
    });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    const c = result.currencies[0].kpis.cash;
    expect(c.totalCollected).toBe('500.00');
    expect(c.byMethod.CASH).toBe('250.00');
    expect(c.byMethod.CARD).toBe('150.00');
    expect(c.byMethod.TRANSFER).toBe('100.00');
    expect(c.byMethod.OTHER).toBe('0.00');
    expect(c.cashRatioPct).toBe('50.00');
  });

  it('cashReconciliationDifference = suma de differences de sesiones cerradas', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-10', 500)],
      closedSessions: [
        { closedAt: new Date('2026-01-10T22:00:00.000-05:00'), difference: new Prisma.Decimal(10) },
        { closedAt: new Date('2026-01-11T22:00:00.000-05:00'), difference: new Prisma.Decimal(-15) },
      ],
    });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    const c = result.currencies[0].kpis.cash;
    expect(c.hasClosedSessions).toBe(true);
    expect(c.cashReconciliationDifference).toBe('-5.00');
  });

  it('cashReconciliationDifference = null si no hay sesiones cerradas', async () => {
    const source = fakeSource({ revenue: [rev(1, '2026-01-10', 500)] });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    expect(result.currencies[0].kpis.cash.hasClosedSessions).toBe(false);
    expect(result.currencies[0].kpis.cash.cashReconciliationDifference).toBeNull();
  });
});

// ─── Buckets y multi-moneda ───────────────────────────────────────────────

describe('incomeStatementService · buckets y multi-moneda', () => {
  it('agrupa por mes', async () => {
    const source = fakeSource({
      revenue: [
        rev(1, '2026-01-10', 500),
        rev(2, '2026-02-10', 800),
      ],
      cogsReal: [
        cogsReal(1, '2026-01-10', 200),
        cogsReal(2, '2026-02-10', 300),
      ],
    });
    const result = await getIncomeStatementSummary(
      { from: '2026-01-01', to: '2026-02-28', granularity: 'month' },
      source,
    );
    const buckets = result.currencies[0].buckets;
    expect(buckets.map(b => b.period)).toEqual(['2026-01', '2026-02']);
    expect(buckets[0].revenue).toBe('500.00');
    expect(buckets[1].revenue).toBe('800.00');
  });

  it('agrupa por año', async () => {
    const source = fakeSource({
      revenue: [
        rev(1, '2025-06-10', 500),
        rev(2, '2026-06-10', 800),
      ],
    });
    const result = await getIncomeStatementSummary(
      { from: '2025-01-01', to: '2026-12-31', granularity: 'year' },
      source,
    );
    const buckets = result.currencies[0].buckets;
    expect(buckets.map(b => b.period)).toEqual(['2025', '2026']);
  });

  it('multi-moneda: agrupa por currency', async () => {
    const source = fakeSource({
      revenue: [
        rev(1, '2026-01-10', 500, 0, 0, null, 'COP'),
        rev(2, '2026-01-10', 300, 0, 0, null, 'USD'),
      ],
    });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    expect(result.currencies.map(c => c.currency).sort()).toEqual(['COP', 'USD']);
  });

  it('rango vacío → currencies vacío', async () => {
    const source = fakeSource({});
    const result = await getIncomeStatementSummary(
      { from: '2040-01-01', to: '2040-01-31', granularity: 'month' },
      source,
    );
    expect(result.currencies).toEqual([]);
  });
});

// ─── Prorrateo de gastos operativos ───────────────────────────────────────

describe('incomeStatementService · prorrateo gastos operativos', () => {
  it('mes completo prorratea 100%', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-15', 1000)],
      cogsReal: [cogsReal(1, '2026-01-15', 0)],
      operational: [op('2026-01', 200, 100, 500)],
    });
    const result = await getIncomeStatementSummary(defaultQuery, source);
    expect(result.currencies[0].pnl.operatingExpenses.total).toBe('800.00');
  });

  it('mes parcial: 15-31 de enero = 17/31', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-20', 1000)],
      operational: [op('2026-01', 310, 0, 0)],
    });
    const result = await getIncomeStatementSummary(
      { from: '2026-01-15', to: '2026-01-31', granularity: 'month' },
      source,
    );
    expect(result.currencies[0].pnl.operatingExpenses.fixed).toBe('170.00');
  });
});