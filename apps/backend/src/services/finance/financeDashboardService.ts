import {
  FinancePaymentMethodKind,
  Prisma,
  PrismaClient,
  FinancePayableStatus,
} from '@prisma/client';
import prisma from '../../lib/prisma';
import {
  getIncomeStatementSummary,
  IncomeStatementOperationError,
  type IncomeStatementDataSource,
  type IncomeStatementSummaryResponse,
} from './incomeStatementService';
import type { FinanceDashboardQuery } from '../../schemas/finance/financeDashboardSchema';

// ─── Tipos internos ────────────────────────────────────────────────────────

type DashboardClient = PrismaClient | Prisma.TransactionClient;

export type PaymentMethodBalanceRow = {
  id: number;
  name: string;
  kind: FinancePaymentMethodKind;
  currency: string;
  currentBalance: Prisma.Decimal;
};

export type UpcomingPayableRow = {
  id: number;
  concept: string;
  amount: Prisma.Decimal;
  currency: string;
  dueDate: Date;
};

export interface FinanceDashboardDataSource {
  loadIncomeStatement(query: FinanceDashboardQuery): Promise<IncomeStatementSummaryResponse>;
  loadPaymentMethodBalances(): Promise<PaymentMethodBalanceRow[]>;
  loadUpcomingPayables(from: Date, to: Date): Promise<UpcomingPayableRow[]>;
}

// ─── Errores ───────────────────────────────────────────────────────────────

export class FinanceDashboardOperationError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'FinanceDashboardOperationError';
  }
}

// ─── Utilidades ────────────────────────────────────────────────────────────

const ZERO = new Prisma.Decimal(0);
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

function money(value: Prisma.Decimal.Value): string {
  return new Prisma.Decimal(value).toFixed(2);
}

function pct(numerator: Prisma.Decimal, denominator: Prisma.Decimal): string {
  if (denominator.isZero()) return '0.00';
  return numerator
    .mul(100)
    .div(denominator)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    .toFixed(2);
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

// ─── Data source Prisma ────────────────────────────────────────────────────

async function loadPaymentMethodBalancesFromDb(
  client: DashboardClient,
): Promise<PaymentMethodBalanceRow[]> {
  return client.financePaymentMethod.findMany({
    where: { active: true },
    orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      kind: true,
      currency: true,
      currentBalance: true,
    },
  });
}

async function loadUpcomingPayablesFromDb(
  client: DashboardClient,
  from: Date,
  to: Date,
): Promise<UpcomingPayableRow[]> {
  return client.financePayable.findMany({
    where: {
      status: FinancePayableStatus.OPEN,
      dueDate: { gte: from, lte: to },
    },
    orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      concept: true,
      amount: true,
      currency: true,
      dueDate: true,
    },
  });
}

export function createPrismaFinanceDashboardDataSource(
  client: DashboardClient = prisma,
  incomeStatementSource?: IncomeStatementDataSource,
): FinanceDashboardDataSource {
  return {
    loadIncomeStatement: (query) =>
      getIncomeStatementSummary(
        { from: query.from, to: query.to, granularity: 'month' },
        incomeStatementSource,
      ),
    loadPaymentMethodBalances: () => loadPaymentMethodBalancesFromDb(client),
    loadUpcomingPayables: (from, to) => loadUpcomingPayablesFromDb(client, from, to),
  };
}

// ─── Contrato de salida ────────────────────────────────────────────────────

export type FinanceDashboardResponse = {
  period: { from: string; to: string };
  currency: string;
  hasIncomeData: boolean;
  multiCurrencyDetected: boolean;

  liquidity: {
    availableBalance: string;
    next7DaysPayables: string;
    coverageRatio: string | null;
    hasPayables: boolean;
    payablesCount: number;
    paymentMethods: Array<{
      id: number;
      name: string;
      kind: FinancePaymentMethodKind;
      currentBalance: string;
    }>;
  };

  efficiency: {
    avgTicket: string;
    foodCostPct: string;
    fixedCostRatioPct: string;
  };

  profitability: {
    revenue: string;
    grossProfit: string;
    grossMarginPct: string;
    operatingProfit: string;
    operatingMarginPct: string;
    netProfit: string;
    netMarginPct: string;
  };
};

// ─── Función principal ─────────────────────────────────────────────────────

export async function getFinanceDashboard(
  query: FinanceDashboardQuery,
  source: FinanceDashboardDataSource = createPrismaFinanceDashboardDataSource(),
): Promise<FinanceDashboardResponse> {
  const start = bogotaStart(query.from);
  const end = bogotaStart(addDays(query.to, 1));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new FinanceDashboardOperationError('INVALID_DATE_RANGE', 400, 'Rango de fechas inválido');
  }

  // CxP a 7 días desde HOY (no desde `from` del período). Es liquidez actual.
  const today = todayInBogota();
  const payablesUntil = addDays(today, 7);
  const payablesFrom = bogotaStart(today);
  const payablesTo = bogotaStart(addDays(payablesUntil, 1));

  let incomeData: IncomeStatementSummaryResponse;
  try {
    incomeData = await source.loadIncomeStatement(query);
  } catch (error) {
    if (error instanceof IncomeStatementOperationError) {
      throw new FinanceDashboardOperationError(error.code, error.statusCode, error.message, error.details);
    }
    throw error;
  }

  const [paymentMethods, payables] = await Promise.all([
    source.loadPaymentMethodBalances(),
    source.loadUpcomingPayables(payablesFrom, payablesTo),
  ]);

  // ─── Liquidez ─────────────────────────────────────────────────────────
  const availableBalance = paymentMethods.reduce(
    (sum, m) => sum.add(m.currentBalance),
    ZERO,
  );
  const next7DaysPayables = payables.reduce(
    (sum, p) => sum.add(p.amount),
    ZERO,
  );
  const coverageRatio = next7DaysPayables.isZero()
    ? null
    : availableBalance
        .div(next7DaysPayables)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
        .toFixed(2);

  // ─── Rentabilidad + Eficiencia (del primer currency del income-statement) ──
  const firstCurrency = incomeData.currencies[0] ?? null;
  const hasIncomeData = firstCurrency !== null;
  const currency = firstCurrency?.currency ?? (paymentMethods[0]?.currency ?? 'COP');
  const multiCurrencyDetected = incomeData.currencies.length > 1;

  let efficiency: FinanceDashboardResponse['efficiency'];
  let profitability: FinanceDashboardResponse['profitability'];

  if (firstCurrency) {
    const pnl = firstCurrency.pnl;
    const kpis = firstCurrency.kpis;
    const revenueDec = new Prisma.Decimal(pnl.revenue.total);
    const fixedCostsDec = new Prisma.Decimal(pnl.operatingExpenses.fixed);

    efficiency = {
      avgTicket: kpis.volume.avgTicket,
      foodCostPct: kpis.margins.foodCostPct,
      fixedCostRatioPct: pct(fixedCostsDec, revenueDec),
    };

    profitability = {
      revenue: pnl.revenue.total,
      grossProfit: pnl.grossProfit,
      grossMarginPct: kpis.margins.grossMarginPct,
      operatingProfit: pnl.operatingProfit,
      operatingMarginPct: kpis.margins.operatingMarginPct,
      netProfit: pnl.netProfit,
      netMarginPct: kpis.margins.netMarginPct,
    };
  } else {
    efficiency = {
      avgTicket: '0.00',
      foodCostPct: '0.00',
      fixedCostRatioPct: '0.00',
    };
    profitability = {
      revenue: '0.00',
      grossProfit: '0.00',
      grossMarginPct: '0.00',
      operatingProfit: '0.00',
      operatingMarginPct: '0.00',
      netProfit: '0.00',
      netMarginPct: '0.00',
    };
  }

  return {
    period: { from: query.from, to: query.to },
    currency,
    hasIncomeData,
    multiCurrencyDetected,
    liquidity: {
      availableBalance: money(availableBalance),
      next7DaysPayables: money(next7DaysPayables),
      coverageRatio,
      hasPayables: payables.length > 0,
      payablesCount: payables.length,
      paymentMethods: paymentMethods.map(m => ({
        id: m.id,
        name: m.name,
        kind: m.kind,
        currentBalance: money(m.currentBalance),
      })),
    },
    efficiency,
    profitability,
  };
}

// ─── Exports para tests ────────────────────────────────────────────────────

export type { IncomeStatementSummaryResponse };