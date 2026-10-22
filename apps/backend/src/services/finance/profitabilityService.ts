import {
  Prisma,
  PrismaClient,
  SalesOrderStatus,
  SalesPaymentStatus,
  SalesPreInvoiceStatus,
} from '@prisma/client';
import prisma from '../../lib/prisma';
import type { ProfitabilitySummaryQuery } from '../../schemas/finance/profitabilitySchema';

// ─── Tipos internos ────────────────────────────────────────────────────────

type ProfitabilityClient = PrismaClient | Prisma.TransactionClient;

export type RevenueRow = {
  orderId: number;
  settledAt: Date;
  currency: string;
  revenue: Prisma.Decimal;
};

export type CogsTheoreticalRow = {
  orderId: number;
  settledAt: Date;
  currency: string;
  quantity: number;
  unitBaseCost: Prisma.Decimal;
};

export type CogsRealRow = {
  orderId: number;
  settledAt: Date;
  currency: string;
  totalCost: Prisma.Decimal;
};

export type OperationalCostRow = {
  month: string;
  fixedCosts: Prisma.Decimal;
  variableCosts: Prisma.Decimal;
  payroll: Prisma.Decimal;
};

export interface ProfitabilityDataSource {
  loadRevenueRows(start: Date, end: Date): Promise<RevenueRow[]>;
  loadCogsTheoreticalRows(start: Date, end: Date): Promise<CogsTheoreticalRow[]>;
  loadCogsRealRows(start: Date, end: Date): Promise<CogsRealRow[]>;
  loadOperationalCosts(months: string[]): Promise<OperationalCostRow[]>;
}

// ─── Errores ───────────────────────────────────────────────────────────────

export class ProfitabilityOperationError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ProfitabilityOperationError';
  }
}

// ─── Utilidades de fecha / dinero ──────────────────────────────────────────

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

function utcTimestampLiteral(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

function bogotaStart(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000-05:00`);
}

function addDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function bogotaYmd(date: Date): string {
  return new Date(date.getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

// ─── Helpers de mes y prorrateo ────────────────────────────────────────────

function monthStart(month: string): string {
  return `${month}-01`;
}

function monthEnd(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, '0')}`;
}

function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function maxYmd(a: string, b: string): string {
  return a > b ? a : b;
}

function minYmd(a: string, b: string): string {
  return a < b ? a : b;
}

function dayDiffInclusive(fromYmd: string, toYmd: string): number {
  const from = new Date(`${fromYmd}T00:00:00.000Z`).getTime();
  const to = new Date(`${toYmd}T00:00:00.000Z`).getTime();
  return Math.round((to - from) / DAY_MS) + 1;
}

function monthsInRange(fromYmd: string, toYmd: string): string[] {
  const months: string[] = [];
  let year = Number(fromYmd.slice(0, 4));
  let month = Number(fromYmd.slice(5, 7));
  const lastMonth = toYmd.slice(0, 7);
  while (true) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    if (key > lastMonth) break;
    months.push(key);
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return months;
}

function prorateMonth(
  row: OperationalCostRow,
  fromYmd: string,
  toYmd: string,
): { fixedCosts: Prisma.Decimal; variableCosts: Prisma.Decimal; payroll: Prisma.Decimal } | null {
  const mStart = monthStart(row.month);
  const mEnd = monthEnd(row.month);
  const effStart = maxYmd(mStart, fromYmd);
  const effEnd = minYmd(mEnd, toYmd);
  if (effStart > effEnd) return null;

  const coveredDays = dayDiffInclusive(effStart, effEnd);
  const totalDays = daysInMonth(row.month);
  if (totalDays === 0 || coveredDays === 0) return null;

  const ratio = new Prisma.Decimal(coveredDays).div(totalDays);
  return {
    fixedCosts: row.fixedCosts.mul(ratio),
    variableCosts: row.variableCosts.mul(ratio),
    payroll: row.payroll.mul(ratio),
  };
}

// ─── Buckets ───────────────────────────────────────────────────────────────

function bucketKey(
  date: Date,
  granularity: ProfitabilitySummaryQuery['granularity'],
): string {
  const ymd = bogotaYmd(date);
  return granularity === 'year' ? ymd.slice(0, 4) : ymd.slice(0, 7);
}

function enumerateBuckets(
  fromYmd: string,
  toYmd: string,
  granularity: ProfitabilitySummaryQuery['granularity'],
): string[] {
  if (granularity === 'year') {
    const result: string[] = [];
    for (let y = Number(fromYmd.slice(0, 4)); y <= Number(toYmd.slice(0, 4)); y += 1) {
      result.push(String(y));
    }
    return result;
  }
  return monthsInRange(fromYmd, toYmd);
}

// ─── Acumuladores ──────────────────────────────────────────────────────────

type BucketAccumulator = {
  revenue: Prisma.Decimal;
  cogsReal: Prisma.Decimal;
  cogsTheoretical: Prisma.Decimal;
  operatingExpenses: Prisma.Decimal;
};

type CurrencyAccumulator = {
  revenue: Prisma.Decimal;
  cogsReal: Prisma.Decimal;
  cogsTheoretical: Prisma.Decimal;
  fixedCosts: Prisma.Decimal;
  variableCosts: Prisma.Decimal;
  payroll: Prisma.Decimal;
  buckets: Map<string, BucketAccumulator>;
};

function emptyBucket(): BucketAccumulator {
  return {
    revenue: ZERO,
    cogsReal: ZERO,
    cogsTheoretical: ZERO,
    operatingExpenses: ZERO,
  };
}

function emptyCurrency(): CurrencyAccumulator {
  return {
    revenue: ZERO,
    cogsReal: ZERO,
    cogsTheoretical: ZERO,
    fixedCosts: ZERO,
    variableCosts: ZERO,
    payroll: ZERO,
    buckets: new Map(),
  };
}

function bucketOf(acc: CurrencyAccumulator, key: string): BucketAccumulator {
  const current = acc.buckets.get(key) ?? emptyBucket();
  acc.buckets.set(key, current);
  return current;
}

// ─── Carga de datos (Prisma) ───────────────────────────────────────────────

async function loadRevenueRowsFromDb(
  client: ProfitabilityClient,
  start: Date,
  end: Date,
): Promise<RevenueRow[]> {
  const startLit = utcTimestampLiteral(start);
  const endLit = utcTimestampLiteral(end);
  return client.$queryRaw<RevenueRow[]>`
    SELECT
      so."id"                         AS "orderId",
      so."settledAt"                  AS "settledAt",
      COALESCE(
        (SELECT "currencySnapshot" FROM "sales_order_items" WHERE "salesOrderId" = so."id" LIMIT 1),
        'COP'
      )                               AS "currency",
      spi."salesAmountSnapshot"       AS "revenue"
    FROM "sales_pre_invoices" spi
    INNER JOIN "sales_orders" so ON so."id" = spi."salesOrderId"
    WHERE spi."status" = ${SalesPreInvoiceStatus.ACTIVE}::"SalesPreInvoiceStatus"
      AND so."status" = ${SalesOrderStatus.SETTLED}::"SalesOrderStatus"
      AND so."paymentStatus" = ${SalesPaymentStatus.PAID}::"SalesPaymentStatus"
      AND so."settledAt" >= ${startLit}::timestamp
      AND so."settledAt" < ${endLit}::timestamp
  `;
}

async function loadCogsTheoreticalRowsFromDb(
  client: ProfitabilityClient,
  start: Date,
  end: Date,
): Promise<CogsTheoreticalRow[]> {
  const startLit = utcTimestampLiteral(start);
  const endLit = utcTimestampLiteral(end);
  return client.$queryRaw<CogsTheoreticalRow[]>`
    SELECT
      so."id"                     AS "orderId",
      so."settledAt"              AS "settledAt",
      soi."currencySnapshot"      AS "currency",
      soi."quantity"              AS "quantity",
      mip."baseCostSnapshot"      AS "unitBaseCost"
    FROM "sales_order_items" soi
    INNER JOIN "sales_orders" so ON so."id" = soi."salesOrderId"
    INNER JOIN "menu_item_prices" mip ON mip."id" = soi."menuItemPriceId"
    WHERE so."status" = ${SalesOrderStatus.SETTLED}::"SalesOrderStatus"
      AND so."paymentStatus" = ${SalesPaymentStatus.PAID}::"SalesPaymentStatus"
      AND so."settledAt" >= ${startLit}::timestamp
      AND so."settledAt" < ${endLit}::timestamp
  `;
}

async function loadCogsRealRowsFromDb(
  client: ProfitabilityClient,
  start: Date,
  end: Date,
): Promise<CogsRealRow[]> {
  const startLit = utcTimestampLiteral(start);
  const endLit = utcTimestampLiteral(end);
  return client.$queryRaw<CogsRealRow[]>`
    SELECT
      so."id"                                   AS "orderId",
      so."settledAt"                            AS "settledAt",
      COALESCE(
        (SELECT "currencySnapshot" FROM "sales_order_items" WHERE "salesOrderId" = so."id" LIMIT 1),
        'COP'
      )                                         AS "currency",
      kici."totalCost"                          AS "totalCost"
    FROM "kitchen_inventory_consumption_items" kici
    INNER JOIN "kitchen_inventory_consumptions" kic ON kic."id" = kici."consumptionId"
    INNER JOIN "kitchen_dispatches" kd ON kd."id" = kic."kitchenDispatchId"
    INNER JOIN "sales_orders" so ON so."id" = kd."salesOrderId"
    WHERE so."status" = ${SalesOrderStatus.SETTLED}::"SalesOrderStatus"
      AND so."paymentStatus" = ${SalesPaymentStatus.PAID}::"SalesPaymentStatus"
      AND so."settledAt" >= ${startLit}::timestamp
      AND so."settledAt" < ${endLit}::timestamp
  `;
}

async function loadOperationalCostsFromDb(
  client: ProfitabilityClient,
  months: string[],
): Promise<OperationalCostRow[]> {
  if (months.length === 0) return [];
  const rows = await client.operationalCostConfig.findMany({
    where: { month: { in: months } },
    select: { month: true, fixedCosts: true, variableCosts: true, payroll: true },
  });
  return rows.map(row => ({
    month: row.month,
    fixedCosts: new Prisma.Decimal(row.fixedCosts),
    variableCosts: new Prisma.Decimal(row.variableCosts),
    payroll: new Prisma.Decimal(row.payroll),
  }));
}

export function createPrismaProfitabilityDataSource(
  client: ProfitabilityClient = prisma,
): ProfitabilityDataSource {
  return {
    loadRevenueRows: (start, end) => loadRevenueRowsFromDb(client, start, end),
    loadCogsTheoreticalRows: (start, end) => loadCogsTheoreticalRowsFromDb(client, start, end),
    loadCogsRealRows: (start, end) => loadCogsRealRowsFromDb(client, start, end),
    loadOperationalCosts: (months) => loadOperationalCostsFromDb(client, months),
  };
}

// ─── Contrato de salida ────────────────────────────────────────────────────

export type ProfitabilitySummaryResponse = {
  period: {
    from: string;
    to: string;
    granularity: ProfitabilitySummaryQuery['granularity'];
  };
  currencies: Array<{
    currency: string;
    totals: {
      revenue: string;
      cogsTheoretical: string;
      cogsReal: string;
      cogsVariance: string;
      grossProfit: string;
      grossMarginPct: string;
      operatingExpenses: {
        fixedCosts: string;
        variableCosts: string;
        payroll: string;
        total: string;
        hasData: boolean;
      };
      operatingProfit: string;
      operatingMarginPct: string;
      foodCostPct: string;
      wastePct: string;
    };
    buckets: Array<{
      period: string;
      revenue: string;
      cogsReal: string;
      grossProfit: string;
      operatingExpenses: string;
      operatingProfit: string;
    }>;
  }>;
};

// ─── Función principal ─────────────────────────────────────────────────────

export async function getProfitabilitySummary(
  query: ProfitabilitySummaryQuery,
  source: ProfitabilityDataSource = createPrismaProfitabilityDataSource(),
): Promise<ProfitabilitySummaryResponse> {
  const start = bogotaStart(query.from);
  const end = bogotaStart(addDays(query.to, 1));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new ProfitabilityOperationError('INVALID_DATE_RANGE', 400, 'Rango de fechas inválido');
  }

  const months = monthsInRange(query.from, query.to);

  const [revenueRows, cogsTheoRows, cogsRealRows, opCostRows] = await Promise.all([
    source.loadRevenueRows(start, end),
    source.loadCogsTheoreticalRows(start, end),
    source.loadCogsRealRows(start, end),
    source.loadOperationalCosts(months),
  ]);

  const hasOperationalData = opCostRows.length > 0;
  const accumulators = new Map<string, CurrencyAccumulator>();
  const accumFor = (currency: string): CurrencyAccumulator => {
    const existing = accumulators.get(currency);
    if (existing) return existing;
    const created = emptyCurrency();
    accumulators.set(currency, created);
    return created;
  };

  // 1) Revenue
  for (const row of revenueRows) {
    const acc = accumFor(row.currency);
    acc.revenue = acc.revenue.add(row.revenue);
    const bucket = bucketOf(acc, bucketKey(row.settledAt, query.granularity));
    bucket.revenue = bucket.revenue.add(row.revenue);
  }

  // 2) COGS teórico
  for (const row of cogsTheoRows) {
    const acc = accumFor(row.currency);
    const lineCost = row.unitBaseCost.mul(row.quantity);
    acc.cogsTheoretical = acc.cogsTheoretical.add(lineCost);
    const bucket = bucketOf(acc, bucketKey(row.settledAt, query.granularity));
    bucket.cogsTheoretical = bucket.cogsTheoretical.add(lineCost);
  }

  // 3) COGS real
  for (const row of cogsRealRows) {
    const acc = accumFor(row.currency);
    acc.cogsReal = acc.cogsReal.add(row.totalCost);
    const bucket = bucketOf(acc, bucketKey(row.settledAt, query.granularity));
    bucket.cogsReal = bucket.cogsReal.add(row.totalCost);
  }

  // 4) Gastos operativos prorrateados por rango y repartidos por % revenue
  const totalRevenueAcrossCurrencies = [...accumulators.values()].reduce(
    (total, acc) => total.add(acc.revenue),
    ZERO,
  );

  for (const row of opCostRows) {
    const prorated = prorateMonth(row, query.from, query.to);
    if (!prorated) continue;
    const monthBucketKey = query.granularity === 'year' ? row.month.slice(0, 4) : row.month;
    for (const acc of accumulators.values()) {
      const ratio = totalRevenueAcrossCurrencies.isZero()
        ? ZERO
        : acc.revenue.div(totalRevenueAcrossCurrencies);
      const fixedShare = prorated.fixedCosts.mul(ratio);
      const variableShare = prorated.variableCosts.mul(ratio);
      const payrollShare = prorated.payroll.mul(ratio);
      acc.fixedCosts = acc.fixedCosts.add(fixedShare);
      acc.variableCosts = acc.variableCosts.add(variableShare);
      acc.payroll = acc.payroll.add(payrollShare);
      const bucket = bucketOf(acc, monthBucketKey);
      bucket.operatingExpenses = bucket.operatingExpenses
        .add(fixedShare).add(variableShare).add(payrollShare);
    }
  }

  // 5) Derivados por moneda
  const allBuckets = enumerateBuckets(query.from, query.to, query.granularity);

  const currencies = [...accumulators.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, acc]): ProfitabilitySummaryResponse['currencies'][number] => {
      const grossProfit = acc.revenue.sub(acc.cogsReal);
      const operatingExpensesTotal = acc.fixedCosts.add(acc.variableCosts).add(acc.payroll);
      const operatingProfit = grossProfit.sub(operatingExpensesTotal);
      const cogsVariance = acc.cogsReal.sub(acc.cogsTheoretical);

      return {
        currency,
        totals: {
          revenue: money(acc.revenue),
          cogsTheoretical: money(acc.cogsTheoretical),
          cogsReal: money(acc.cogsReal),
          cogsVariance: money(cogsVariance),
          grossProfit: money(grossProfit),
          grossMarginPct: pct(grossProfit, acc.revenue),
          operatingExpenses: {
            fixedCosts: money(acc.fixedCosts),
            variableCosts: money(acc.variableCosts),
            payroll: money(acc.payroll),
            total: money(operatingExpensesTotal),
            hasData: hasOperationalData,
          },
          operatingProfit: money(operatingProfit),
          operatingMarginPct: pct(operatingProfit, acc.revenue),
          foodCostPct: pct(acc.cogsReal, acc.revenue),
          wastePct: pct(cogsVariance, acc.cogsTheoretical),
        },
        buckets: allBuckets.map(key => {
          const b = acc.buckets.get(key) ?? emptyBucket();
          const bucketGross = b.revenue.sub(b.cogsReal);
          const bucketOperating = bucketGross.sub(b.operatingExpenses);
          return {
            period: key,
            revenue: money(b.revenue),
            cogsReal: money(b.cogsReal),
            grossProfit: money(bucketGross),
            operatingExpenses: money(b.operatingExpenses),
            operatingProfit: money(bucketOperating),
          };
        }),
      };
    });

  return {
    period: {
      from: query.from,
      to: query.to,
      granularity: query.granularity,
    },
    currencies,
  };
}