import { describe, expect, it } from 'vitest';
import {
  FinancePaymentMethodKind,
  Prisma,
} from '@prisma/client';
import type {
  FinanceDashboardDataSource,
  PaymentMethodBalanceRow,
  UpcomingPayableRow,
} from '../../../src/services/finance/financeDashboardService';
import { getFinanceDashboard } from '../../../src/services/finance/financeDashboardService';
import type { IncomeStatementSummaryResponse } from '../../../src/services/finance/incomeStatementService';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function emptyIncomeStatement(currency = 'COP'): IncomeStatementSummaryResponse {
  return {
    period: { from: '2026-03-01', to: '2026-03-31', granularity: 'month' },
    currencies: [{
      currency,
      pnl: {
        revenue: {
          sales: '0.00',
          service: '0.00',
          total: '0.00',
          consumptionTax: '0.00',
        },
        cogs: { real: '0.00', theoretical: '0.00', variance: '0.00' },
        grossProfit: '0.00',
        operatingExpenses: {
          fixed: '0.00',
          variable: '0.00',
          payroll: '0.00',
          total: '0.00',
          hasData: false,
        },
        operatingProfit: '0.00',
        netProfit: '0.00',
      },
      kpis: {
        margins: {
          grossMarginPct: '0.00',
          operatingMarginPct: '0.00',
          netMarginPct: '0.00',
          foodCostPct: '0.00',
          primeCostPct: '0.00',
          wastePct: '0.00',
        },
        costStructure: {
          laborCostPct: '0.00',
          rentCostPct: '0.00',
          variableCostPct: '0.00',
          totalCostPct: '0.00',
        },
        breakEven: {
          revenue: '0.00',
          orders: '0.00',
          marginOfSafetyPct: '0.00',
          feasible: false,
        },
        volume: {
          orderCount: 0,
          avgTicket: '0.00',
          totalGuests: 0,
          avgGuestsPerOrder: '0.00',
          revenuePerGuest: '0.00',
          unitsSold: 0,
          hasGuestData: false,
        },
        operations: {
          tableTurnover: '0.00',
          avgKitchenTimeMinutes: null,
          hasDispatchData: false,
          reservationCompletionRatePct: null,
          totalReservations: 0,
        },
        cash: {
          totalCollected: '0.00',
          byMethod: { CASH: '0.00', CARD: '0.00', TRANSFER: '0.00', OTHER: '0.00' },
          cashRatioPct: '0.00',
          cashReconciliationDifference: null,
          hasClosedSessions: false,
        },
      },
      buckets: [],
    }],
  };
}

function incomeStatementWithData(): IncomeStatementSummaryResponse {
  const base = emptyIncomeStatement('COP');
  const c = base.currencies[0];
  c.pnl.revenue.sales = '1000.00';
  c.pnl.revenue.service = '100.00';
  c.pnl.revenue.total = '1100.00';
  c.pnl.revenue.consumptionTax = '80.00';
  c.pnl.cogs.real = '300.00';
  c.pnl.cogs.theoretical = '290.00';
  c.pnl.cogs.variance = '10.00';
  c.pnl.grossProfit = '800.00';
  c.pnl.operatingExpenses = {
    fixed: '200.00',
    variable: '100.00',
    payroll: '500.00',
    total: '800.00',
    hasData: true,
  };
  c.pnl.operatingProfit = '0.00';
  c.pnl.netProfit = '0.00';
  c.kpis.margins.grossMarginPct = '72.73';
  c.kpis.margins.operatingMarginPct = '0.00';
  c.kpis.margins.netMarginPct = '0.00';
  c.kpis.margins.foodCostPct = '27.27';
  c.kpis.volume.avgTicket = '550.00';
  c.kpis.volume.orderCount = 2;
  return base;
}

function method(overrides: Partial<PaymentMethodBalanceRow> = {}): PaymentMethodBalanceRow {
  return {
    id: 1,
    name: 'Caja',
    kind: FinancePaymentMethodKind.CASH,
    currency: 'COP',
    currentBalance: new Prisma.Decimal(1000),
    ...overrides,
  };
}

function payable(overrides: Partial<UpcomingPayableRow> = {}): UpcomingPayableRow {
  return {
    id: 1,
    concept: 'Arriendo',
    amount: new Prisma.Decimal(500),
    currency: 'COP',
    dueDate: new Date('2026-03-25T12:00:00.000-05:00'),
    ...overrides,
  };
}

function fakeSource(opts: {
  incomeStatement?: IncomeStatementSummaryResponse;
  methods?: PaymentMethodBalanceRow[];
  payables?: UpcomingPayableRow[];
}): FinanceDashboardDataSource {
  return {
    loadIncomeStatement: async () => opts.incomeStatement ?? emptyIncomeStatement(),
    loadPaymentMethodBalances: async () => opts.methods ?? [],
    loadUpcomingPayables: async () => opts.payables ?? [],
  };
}

const defaultQuery = { from: '2026-03-01', to: '2026-03-31' };

// ─── Liquidez ─────────────────────────────────────────────────────────────

describe('financeDashboardService · liquidez', () => {
  it('calcula saldo disponible, CxP 7d y cobertura', async () => {
    const source = fakeSource({
      methods: [
        method({ id: 1, name: 'Caja', currentBalance: new Prisma.Decimal(1000) }),
        method({ id: 2, name: 'Banco', kind: FinancePaymentMethodKind.BANK, currentBalance: new Prisma.Decimal(2000) }),
      ],
      payables: [payable({ amount: new Prisma.Decimal(500) }), payable({ id: 2, amount: new Prisma.Decimal(500) })],
    });
    const result = await getFinanceDashboard(defaultQuery, source);
    expect(result.liquidity.availableBalance).toBe('3000.00');
    expect(result.liquidity.next7DaysPayables).toBe('1000.00');
    expect(result.liquidity.coverageRatio).toBe('3.00');
    expect(result.liquidity.hasPayables).toBe(true);
    expect(result.liquidity.payablesCount).toBe(2);
    expect(result.liquidity.paymentMethods).toHaveLength(2);
  });

  it('sin CxP → coverage null', async () => {
    const source = fakeSource({
      methods: [method({ currentBalance: new Prisma.Decimal(500) })],
      payables: [],
    });
    const result = await getFinanceDashboard(defaultQuery, source);
    expect(result.liquidity.availableBalance).toBe('500.00');
    expect(result.liquidity.next7DaysPayables).toBe('0.00');
    expect(result.liquidity.coverageRatio).toBeNull();
    expect(result.liquidity.hasPayables).toBe(false);
  });

  it('saldo 0 con CxP → coverage 0.00', async () => {
    const source = fakeSource({
      methods: [method({ currentBalance: new Prisma.Decimal(0) })],
      payables: [payable({ amount: new Prisma.Decimal(500) })],
    });
    const result = await getFinanceDashboard(defaultQuery, source);
    expect(result.liquidity.availableBalance).toBe('0.00');
    expect(result.liquidity.coverageRatio).toBe('0.00');
    expect(result.liquidity.hasPayables).toBe(true);
  });

  it('múltiples métodos se suman correctamente', async () => {
    const source = fakeSource({
      methods: [
        method({ id: 1, currentBalance: new Prisma.Decimal(100) }),
        method({ id: 2, currentBalance: new Prisma.Decimal(200) }),
        method({ id: 3, currentBalance: new Prisma.Decimal(300) }),
      ],
    });
    const result = await getFinanceDashboard(defaultQuery, source);
    expect(result.liquidity.availableBalance).toBe('600.00');
  });
});

// ─── Eficiencia ───────────────────────────────────────────────────────────

describe('financeDashboardService · eficiencia', () => {
  it('ticket promedio + food cost vienen del income-statement', async () => {
    const source = fakeSource({ incomeStatement: incomeStatementWithData() });
    const result = await getFinanceDashboard(defaultQuery, source);
    expect(result.efficiency.avgTicket).toBe('550.00');
    expect(result.efficiency.foodCostPct).toBe('27.27');
  });

  it('fixedCostRatioPct = fixed / revenue', async () => {
    const source = fakeSource({ incomeStatement: incomeStatementWithData() });
    const result = await getFinanceDashboard(defaultQuery, source);
    // 200 / 1100 = 18.18%
    expect(result.efficiency.fixedCostRatioPct).toBe('18.18');
  });

  it('sin income data → efficiency en 0', async () => {
    const source = fakeSource({ incomeStatement: emptyIncomeStatement() });
    const result = await getFinanceDashboard(defaultQuery, source);
    expect(result.efficiency.avgTicket).toBe('0.00');
    expect(result.efficiency.foodCostPct).toBe('0.00');
    expect(result.efficiency.fixedCostRatioPct).toBe('0.00');
  });
});

// ─── Rentabilidad ────────────────────────────────────────────────────────

describe('financeDashboardService · rentabilidad', () => {
  it('márgenes y resultado vienen del income-statement', async () => {
    const source = fakeSource({ incomeStatement: incomeStatementWithData() });
    const result = await getFinanceDashboard(defaultQuery, source);
    expect(result.profitability.revenue).toBe('1100.00');
    expect(result.profitability.grossProfit).toBe('800.00');
    expect(result.profitability.grossMarginPct).toBe('72.73');
    expect(result.profitability.operatingProfit).toBe('0.00');
    expect(result.profitability.netProfit).toBe('0.00');
  });

  it('sin income data → profitability en 0', async () => {
    const source = fakeSource({ incomeStatement: emptyIncomeStatement() });
    const result = await getFinanceDashboard(defaultQuery, source);
    expect(result.profitability.revenue).toBe('0.00');
    expect(result.profitability.grossMarginPct).toBe('0.00');
    expect(result.hasIncomeData).toBe(true);
  });
});

// ─── Casos borde ─────────────────────────────────────────────────────────

describe('financeDashboardService · casos borde', () => {
  it('sin currencies en income-statement → hasIncomeData=false', async () => {
    const emptyNoCurrencies: IncomeStatementSummaryResponse = {
      period: { from: '2026-03-01', to: '2026-03-31', granularity: 'month' },
      currencies: [],
    };
    const source = fakeSource({ incomeStatement: emptyNoCurrencies });
    const result = await getFinanceDashboard(defaultQuery, source);
    expect(result.hasIncomeData).toBe(false);
    expect(result.profitability.revenue).toBe('0.00');
  });

  it('multi-moneda en income → multiCurrencyDetected=true', async () => {
    const multi = incomeStatementWithData();
    multi.currencies.push({ ...multi.currencies[0], currency: 'USD' });
    const source = fakeSource({ incomeStatement: multi });
    const result = await getFinanceDashboard(defaultQuery, source);
    expect(result.multiCurrencyDetected).toBe(true);
    expect(result.currency).toBe('COP'); // toma el primero
  });

  it('currency viene del payment method si no hay income', async () => {
    const emptyNoCurrencies: IncomeStatementSummaryResponse = {
      period: { from: '2026-03-01', to: '2026-03-31', granularity: 'month' },
      currencies: [],
    };
    const source = fakeSource({
      incomeStatement: emptyNoCurrencies,
      methods: [method({ currency: 'COP' })],
    });
    const result = await getFinanceDashboard(defaultQuery, source);
    expect(result.currency).toBe('COP');
  });

  it('period refleja el query original', async () => {
    const source = fakeSource({});
    const result = await getFinanceDashboard(
      { from: '2026-01-15', to: '2026-01-31' },
      source,
    );
    expect(result.period).toEqual({ from: '2026-01-15', to: '2026-01-31' });
  });
});