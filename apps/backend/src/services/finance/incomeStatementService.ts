import {
  CashPaymentMethod,
  CashSessionStatus,
  Prisma,
  PrismaClient,
  ReservationStatus,
  SalesOrderStatus,
  SalesPaymentStatus,
  SalesPreInvoiceStatus,
} from '@prisma/client';
import prisma from '../../lib/prisma';
import type { IncomeStatementSummaryQuery } from '../../schemas/finance/incomeStatementSchema';

// ─── Tipos internos ────────────────────────────────────────────────────────

type FinanceClient = PrismaClient | Prisma.TransactionClient;

export type RevenueRow = {
  orderId: number;
  settledAt: Date;
  currency: string;
  salesAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  serviceAmount: Prisma.Decimal;
  guestCount: number | null;
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

export type CashPaymentRow = {
  method: CashPaymentMethod;
  currency: string;
  amount: Prisma.Decimal;
};

export type ClosedCashSessionRow = {
  closedAt: Date;
  difference: Prisma.Decimal | null;
};

export type KitchenDispatchRow = {
  orderId: number;
  dispatchedAt: Date;
  deliveredAt: Date;
};

export type ReservationRow = {
  status: ReservationStatus;
};

export type VolumeRow = {
  orderId: number;
  unitsSold: number;
};

export interface IncomeStatementDataSource {
  loadRevenueRows(start: Date, end: Date): Promise<RevenueRow[]>;
  loadCogsTheoreticalRows(start: Date, end: Date): Promise<CogsTheoreticalRow[]>;
  loadCogsRealRows(start: Date, end: Date): Promise<CogsRealRow[]>;
  loadOperationalCosts(months: string[]): Promise<OperationalCostRow[]>;
  loadCashPaymentRows(start: Date, end: Date): Promise<CashPaymentRow[]>;
  loadClosedCashSessions(start: Date, end: Date): Promise<ClosedCashSessionRow[]>;
  loadKitchenDispatchRows(start: Date, end: Date): Promise<KitchenDispatchRow[]>;
  loadReservationRows(start: Date, end: Date): Promise<ReservationRow[]>;
  countActiveTables(): Promise<number>;
  loadVolumeRows(start: Date, end: Date): Promise<VolumeRow[]>;
}

// ─── Errores ───────────────────────────────────────────────────────────────

export class IncomeStatementOperationError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'IncomeStatementOperationError';
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

function ratio(numerator: Prisma.Decimal, denominator: Prisma.Decimal): Prisma.Decimal {
  if (denominator.isZero()) return ZERO;
  return numerator.div(denominator);
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

// ─── Meses y prorrateo ─────────────────────────────────────────────────────

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

  const r = new Prisma.Decimal(coveredDays).div(totalDays);
  return {
    fixedCosts: row.fixedCosts.mul(r),
    variableCosts: row.variableCosts.mul(r),
    payroll: row.payroll.mul(r),
  };
}

// ─── Buckets ───────────────────────────────────────────────────────────────

function bucketKey(
  date: Date,
  granularity: IncomeStatementSummaryQuery['granularity'],
): string {
  const ymd = bogotaYmd(date);
  return granularity === 'year' ? ymd.slice(0, 4) : ymd.slice(0, 7);
}

function enumerateBuckets(
  fromYmd: string,
  toYmd: string,
  granularity: IncomeStatementSummaryQuery['granularity'],
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
  operatingExpenses: Prisma.Decimal;
};

type CurrencyAccumulator = {
  salesAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  serviceAmount: Prisma.Decimal;
  revenueTotal: Prisma.Decimal;
  cogsReal: Prisma.Decimal;
  cogsTheoretical: Prisma.Decimal;
  fixedCosts: Prisma.Decimal;
  variableCosts: Prisma.Decimal;
  payroll: Prisma.Decimal;
  orderIds: Set<number>;
  totalGuests: number;
  hasGuests: boolean;
  unitsSold: number;
  cashByMethod: Map<CashPaymentMethod, Prisma.Decimal>;
  buckets: Map<string, BucketAccumulator>;
};

function emptyBucket(): BucketAccumulator {
  return { revenue: ZERO, cogsReal: ZERO, operatingExpenses: ZERO };
}

function emptyCurrency(): CurrencyAccumulator {
  return {
    salesAmount: ZERO,
    taxAmount: ZERO,
    serviceAmount: ZERO,
    revenueTotal: ZERO,
    cogsReal: ZERO,
    cogsTheoretical: ZERO,
    fixedCosts: ZERO,
    variableCosts: ZERO,
    payroll: ZERO,
    orderIds: new Set(),
    totalGuests: 0,
    hasGuests: false,
    unitsSold: 0,
    cashByMethod: new Map([
      [CashPaymentMethod.CASH, ZERO],
      [CashPaymentMethod.CARD, ZERO],
      [CashPaymentMethod.TRANSFER, ZERO],
      [CashPaymentMethod.OTHER, ZERO],
    ]),
    buckets: new Map(),
  };
}

function bucketOf(acc: CurrencyAccumulator, key: string): BucketAccumulator {
  const current = acc.buckets.get(key) ?? emptyBucket();
  acc.buckets.set(key, current);
  return current;
}

// ─── Queries SQL ───────────────────────────────────────────────────────────

async function loadRevenueRowsFromDb(
  client: FinanceClient,
  start: Date,
  end: Date,
): Promise<RevenueRow[]> {
  const startLit = utcTimestampLiteral(start);
  const endLit = utcTimestampLiteral(end);
  return client.$queryRaw<RevenueRow[]>`
    SELECT
      so."id"                              AS "orderId",
      so."settledAt"                       AS "settledAt",
      COALESCE(
        (SELECT "currencySnapshot" FROM "sales_order_items" WHERE "salesOrderId" = so."id" LIMIT 1),
        'COP'
      )                                    AS "currency",
      spi."salesAmountSnapshot"            AS "salesAmount",
      spi."consumptionTaxAmountSnapshot"   AS "taxAmount",
      spi."serviceAmountSnapshot"          AS "serviceAmount",
      so."guestCount"                      AS "guestCount"
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
  client: FinanceClient,
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
  client: FinanceClient,
  start: Date,
  end: Date,
): Promise<CogsRealRow[]> {
  const startLit = utcTimestampLiteral(start);
  const endLit = utcTimestampLiteral(end);
  return client.$queryRaw<CogsRealRow[]>`
    SELECT
      so."id"              AS "orderId",
      so."settledAt"       AS "settledAt",
      COALESCE(
        (SELECT "currencySnapshot" FROM "sales_order_items" WHERE "salesOrderId" = so."id" LIMIT 1),
        'COP'
      )                    AS "currency",
      kici."totalCost"     AS "totalCost"
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
  client: FinanceClient,
  months: string[],
): Promise<OperationalCostRow[]> {
  if (months.length === 0) return [];
  const rows = await client.operationalCostConfig.findMany({
    where: { month: { in: months } },
    select: { month: true, fixedCosts: true, variableCosts: true, payroll: true },
  });
  return rows.map(r => ({
    month: r.month,
    fixedCosts: new Prisma.Decimal(r.fixedCosts),
    variableCosts: new Prisma.Decimal(r.variableCosts),
    payroll: new Prisma.Decimal(r.payroll),
  }));
}

async function loadCashPaymentRowsFromDb(
  client: FinanceClient,
  start: Date,
  end: Date,
): Promise<CashPaymentRow[]> {
  const startLit = utcTimestampLiteral(start);
  const endLit = utcTimestampLiteral(end);
  return client.$queryRaw<CashPaymentRow[]>`
    SELECT
      cp."method"                    AS "method",
      COALESCE(
        (SELECT "currencySnapshot" FROM "sales_order_items"
          WHERE "salesOrderId" = spi."salesOrderId" LIMIT 1),
        'COP'
      )                              AS "currency",
      cp."amount"                    AS "amount"
    FROM "cash_payments" cp
    INNER JOIN "sales_pre_invoices" spi ON spi."id" = cp."preInvoiceId"
    WHERE cp."receivedAt" >= ${startLit}::timestamp
      AND cp."receivedAt" < ${endLit}::timestamp
  `;
}

async function loadClosedCashSessionsFromDb(
  client: FinanceClient,
  start: Date,
  end: Date,
): Promise<ClosedCashSessionRow[]> {
  const startLit = utcTimestampLiteral(start);
  const endLit = utcTimestampLiteral(end);
  return client.$queryRaw<ClosedCashSessionRow[]>`
    SELECT cs."closedAt" AS "closedAt", cs."difference" AS "difference"
    FROM "cash_sessions" cs
    WHERE cs."status" = ${CashSessionStatus.CLOSED}::"CashSessionStatus"
      AND cs."closedAt" IS NOT NULL
      AND cs."closedAt" >= ${startLit}::timestamp
      AND cs."closedAt" < ${endLit}::timestamp
  `;
}

async function loadKitchenDispatchRowsFromDb(
  client: FinanceClient,
  start: Date,
  end: Date,
): Promise<KitchenDispatchRow[]> {
  const startLit = utcTimestampLiteral(start);
  const endLit = utcTimestampLiteral(end);
  return client.$queryRaw<KitchenDispatchRow[]>`
    SELECT
      so."id"               AS "orderId",
      kd."dispatchedAt"     AS "dispatchedAt",
      kd."deliveredAt"      AS "deliveredAt"
    FROM "kitchen_dispatches" kd
    INNER JOIN "sales_orders" so ON so."id" = kd."salesOrderId"
    WHERE kd."deliveredAt" IS NOT NULL
      AND so."status" = ${SalesOrderStatus.SETTLED}::"SalesOrderStatus"
      AND so."paymentStatus" = ${SalesPaymentStatus.PAID}::"SalesPaymentStatus"
      AND so."settledAt" >= ${startLit}::timestamp
      AND so."settledAt" < ${endLit}::timestamp
  `;
}

async function loadReservationRowsFromDb(
  client: FinanceClient,
  start: Date,
  end: Date,
): Promise<ReservationRow[]> {
  const startLit = utcTimestampLiteral(start);
  const endLit = utcTimestampLiteral(end);
  const rows = await client.$queryRaw<Array<{ status: ReservationStatus }>>`
    SELECT r."status" AS "status"
    FROM "reservations" r
    WHERE r."scheduledAt" >= ${startLit}::timestamp
      AND r."scheduledAt" < ${endLit}::timestamp
  `;
  return rows.map(r => ({ status: r.status }));
}

async function countActiveTablesFromDb(client: FinanceClient): Promise<number> {
  return client.diningTable.count({ where: { active: true } });
}

async function loadVolumeRowsFromDb(
  client: FinanceClient,
  start: Date,
  end: Date,
): Promise<VolumeRow[]> {
  const startLit = utcTimestampLiteral(start);
  const endLit = utcTimestampLiteral(end);
  return client.$queryRaw<VolumeRow[]>`
    SELECT
      so."id"                              AS "orderId",
      COALESCE(SUM(soi."quantity"), 0)::int AS "unitsSold"
    FROM "sales_orders" so
    LEFT JOIN "sales_order_items" soi ON soi."salesOrderId" = so."id"
    WHERE so."status" = ${SalesOrderStatus.SETTLED}::"SalesOrderStatus"
      AND so."paymentStatus" = ${SalesPaymentStatus.PAID}::"SalesPaymentStatus"
      AND so."settledAt" >= ${startLit}::timestamp
      AND so."settledAt" < ${endLit}::timestamp
    GROUP BY so."id"
  `;
}

export function createPrismaIncomeStatementDataSource(
  client: FinanceClient = prisma,
): IncomeStatementDataSource {
  return {
    loadRevenueRows: (start, end) => loadRevenueRowsFromDb(client, start, end),
    loadCogsTheoreticalRows: (start, end) => loadCogsTheoreticalRowsFromDb(client, start, end),
    loadCogsRealRows: (start, end) => loadCogsRealRowsFromDb(client, start, end),
    loadOperationalCosts: (months) => loadOperationalCostsFromDb(client, months),
    loadCashPaymentRows: (start, end) => loadCashPaymentRowsFromDb(client, start, end),
    loadClosedCashSessions: (start, end) => loadClosedCashSessionsFromDb(client, start, end),
    loadKitchenDispatchRows: (start, end) => loadKitchenDispatchRowsFromDb(client, start, end),
    loadReservationRows: (start, end) => loadReservationRowsFromDb(client, start, end),
    countActiveTables: () => countActiveTablesFromDb(client),
    loadVolumeRows: (start, end) => loadVolumeRowsFromDb(client, start, end),
  };
}

// ─── Response type ─────────────────────────────────────────────────────────

export type IncomeStatementSummaryResponse = {
  period: {
    from: string;
    to: string;
    granularity: IncomeStatementSummaryQuery['granularity'];
  };
  currencies: Array<{
    currency: string;
    pnl: {
      revenue: {
        sales: string;
        service: string;
        total: string;
        consumptionTax: string;
      };
      cogs: {
        real: string;
        theoretical: string;
        variance: string;
      };
      grossProfit: string;
      operatingExpenses: {
        fixed: string;
        variable: string;
        payroll: string;
        total: string;
        hasData: boolean;
      };
      operatingProfit: string;
      netProfit: string;
    };
    kpis: {
      margins: {
        grossMarginPct: string;
        operatingMarginPct: string;
        netMarginPct: string;
        foodCostPct: string;
        primeCostPct: string;
        wastePct: string;
      };
      costStructure: {
        laborCostPct: string;
        rentCostPct: string;
        variableCostPct: string;
        totalCostPct: string;
      };
      breakEven: {
        revenue: string;
        orders: string;
        marginOfSafetyPct: string;
        feasible: boolean;
      };
      volume: {
        orderCount: number;
        avgTicket: string;
        totalGuests: number;
        avgGuestsPerOrder: string;
        revenuePerGuest: string;
        unitsSold: number;
        hasGuestData: boolean;
      };
      operations: {
        tableTurnover: string;
        avgKitchenTimeMinutes: number | null;
        hasDispatchData: boolean;
        reservationCompletionRatePct: string | null;
        totalReservations: number;
      };
      cash: {
        totalCollected: string;
        byMethod: Record<CashPaymentMethod, string>;
        cashRatioPct: string;
        cashReconciliationDifference: string | null;
        hasClosedSessions: boolean;
      };
    };
    buckets: Array<{
      period: string;
      revenue: string;
      grossProfit: string;
      operatingProfit: string;
      netProfit: string;
    }>;
  }>;
};

// ─── Función principal ─────────────────────────────────────────────────────

export async function getIncomeStatementSummary(
  query: IncomeStatementSummaryQuery,
  source: IncomeStatementDataSource = createPrismaIncomeStatementDataSource(),
): Promise<IncomeStatementSummaryResponse> {
  const start = bogotaStart(query.from);
  const end = bogotaStart(addDays(query.to, 1));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new IncomeStatementOperationError('INVALID_DATE_RANGE', 400, 'Rango de fechas inválido');
  }

  const months = monthsInRange(query.from, query.to);

  const [
    revenueRows,
    cogsTheoRows,
    cogsRealRows,
    opCostRows,
    cashRows,
    closedSessions,
    dispatches,
    reservations,
    activeTables,
    volumeRows,
  ] = await Promise.all([
    source.loadRevenueRows(start, end),
    source.loadCogsTheoreticalRows(start, end),
    source.loadCogsRealRows(start, end),
    source.loadOperationalCosts(months),
    source.loadCashPaymentRows(start, end),
    source.loadClosedCashSessions(start, end),
    source.loadKitchenDispatchRows(start, end),
    source.loadReservationRows(start, end),
    source.countActiveTables(),
    source.loadVolumeRows(start, end),
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

  // 1) Revenue (sales + service + tax)
  for (const row of revenueRows) {
    const acc = accumFor(row.currency);
    acc.salesAmount = acc.salesAmount.add(row.salesAmount);
    acc.serviceAmount = acc.serviceAmount.add(row.serviceAmount);
    acc.taxAmount = acc.taxAmount.add(row.taxAmount);
    acc.revenueTotal = acc.revenueTotal.add(row.salesAmount).add(row.serviceAmount);
    acc.orderIds.add(row.orderId);
    if (row.guestCount !== null && row.guestCount > 0) {
      acc.totalGuests += row.guestCount;
      acc.hasGuests = true;
    }
    const bucket = bucketOf(acc, bucketKey(row.settledAt, query.granularity));
    bucket.revenue = bucket.revenue.add(row.salesAmount).add(row.serviceAmount);
  }

  // 2) COGS teórico
  for (const row of cogsTheoRows) {
    const acc = accumFor(row.currency);
    acc.cogsTheoretical = acc.cogsTheoretical.add(row.unitBaseCost.mul(row.quantity));
  }

  // 3) COGS real
  for (const row of cogsRealRows) {
    const acc = accumFor(row.currency);
    acc.cogsReal = acc.cogsReal.add(row.totalCost);
    const bucket = bucketOf(acc, bucketKey(row.settledAt, query.granularity));
    bucket.cogsReal = bucket.cogsReal.add(row.totalCost);
  }

  // 4) Gastos operativos prorrateados + asignación por % revenue
  const totalRevenueAcrossCurrencies = [...accumulators.values()].reduce(
    (t, acc) => t.add(acc.revenueTotal), ZERO,
  );
  for (const row of opCostRows) {
    const prorated = prorateMonth(row, query.from, query.to);
    if (!prorated) continue;
    const monthBucketKey = query.granularity === 'year' ? row.month.slice(0, 4) : row.month;
    for (const acc of accumulators.values()) {
      const share = totalRevenueAcrossCurrencies.isZero()
        ? ZERO
        : acc.revenueTotal.div(totalRevenueAcrossCurrencies);
      const fixed = prorated.fixedCosts.mul(share);
      const variable = prorated.variableCosts.mul(share);
      const payroll = prorated.payroll.mul(share);
      acc.fixedCosts = acc.fixedCosts.add(fixed);
      acc.variableCosts = acc.variableCosts.add(variable);
      acc.payroll = acc.payroll.add(payroll);
      const bucket = bucketOf(acc, monthBucketKey);
      bucket.operatingExpenses = bucket.operatingExpenses.add(fixed).add(variable).add(payroll);
    }
  }

  // 5) Cash by method
  for (const row of cashRows) {
    const acc = accumulators.get(row.currency);
    if (!acc) continue;
    acc.cashByMethod.set(
      row.method,
      (acc.cashByMethod.get(row.method) ?? ZERO).add(row.amount),
    );
  }

  // 6) Volume: units sold
  for (const row of volumeRows) {
    // Asignar unitsSold a la currency de esa orden
    // Buscamos por orderId en los accumulators
    // Como el acumulador no guarda mapping orderId->currency, tomamos el ratio de revenue
    // Simplificación: asignamos el total por orden a la currency del acumulador con más revenue
    const totalUnits = Number(row.unitsSold ?? 0);
    if (totalUnits <= 0) continue;
    // Si hay una sola currency, se asigna directo. Si hay varias, se reparte por % revenue
    const entries = [...accumulators.entries()];
    if (entries.length === 1) {
      entries[0][1].unitsSold += totalUnits;
    } else {
      for (const [, acc] of entries) {
        const share = totalRevenueAcrossCurrencies.isZero()
          ? ZERO
          : acc.revenueTotal.div(totalRevenueAcrossCurrencies);
        acc.unitsSold += Math.round(totalUnits * Number(share));
      }
    }
  }

  // 7) Operaciones: dispatch times
  let totalDispatchMinutes = 0;
  let dispatchCount = 0;
  for (const d of dispatches) {
    const minutes = (d.deliveredAt.getTime() - d.dispatchedAt.getTime()) / 60_000;
    if (minutes >= 0 && Number.isFinite(minutes)) {
      totalDispatchMinutes += minutes;
      dispatchCount += 1;
    }
  }
  const avgKitchenTimeMinutes = dispatchCount === 0
    ? null
    : Math.round((totalDispatchMinutes / dispatchCount) * 10) / 10;
  const hasDispatchData = dispatchCount > 0;

  // 8) Reservas
  let totalReservations = 0;
  let completedReservations = 0;
  let cancelledReservations = 0;
  for (const r of reservations) {
    totalReservations += 1;
    if (r.status === ReservationStatus.COMPLETED) completedReservations += 1;
    if (r.status === ReservationStatus.CANCELLED) cancelledReservations += 1;
  }
  const closedReservations = completedReservations + cancelledReservations;
  const reservationCompletionRatePct = closedReservations === 0
    ? null
    : pct(new Prisma.Decimal(completedReservations), new Prisma.Decimal(closedReservations));

  // 9) Cash reconciliation (closed sessions)
  const hasClosedSessions = closedSessions.length > 0;
  const cashReconciliationDifference = hasClosedSessions
    ? money(closedSessions.reduce(
        (sum, s) => sum.add(s.difference ?? ZERO),
        ZERO,
      ))
    : null;

  // 10) Derivados por currency
  const allBuckets = enumerateBuckets(query.from, query.to, query.granularity);

  const currencies = [...accumulators.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, acc]): IncomeStatementSummaryResponse['currencies'][number] => {
      const operatingExpensesTotal = acc.fixedCosts.add(acc.variableCosts).add(acc.payroll);
      const grossProfit = acc.revenueTotal.sub(acc.cogsReal);
      const operatingProfit = grossProfit.sub(operatingExpensesTotal);
      const netProfit = operatingProfit; // sin depreciación/impuestos modelados aún
      const cogsVariance = acc.cogsReal.sub(acc.cogsTheoretical);

      const orderCount = acc.orderIds.size;
      const avgTicket = orderCount === 0
        ? ZERO
        : acc.revenueTotal.div(orderCount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const avgGuestsPerOrder = (orderCount === 0 || acc.totalGuests === 0)
        ? ZERO
        : new Prisma.Decimal(acc.totalGuests).div(orderCount)
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const revenuePerGuest = acc.totalGuests === 0
        ? ZERO
        : acc.revenueTotal.div(acc.totalGuests)
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

      // Break-even
      const grossMarginDecimal = ratio(grossProfit, acc.revenueTotal);
      const breakEvenFeasible = grossMarginDecimal.gt(0) && acc.fixedCosts.gt(0);
      const breakEvenRevenue = breakEvenFeasible
        ? acc.fixedCosts.div(grossMarginDecimal).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
        : ZERO;
      const breakEvenOrders = breakEvenFeasible && avgTicket.gt(0)
        ? breakEvenRevenue.div(avgTicket).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
        : ZERO;
      const marginOfSafetyPct = breakEvenFeasible
        ? pct(acc.revenueTotal.sub(breakEvenRevenue), acc.revenueTotal)
        : '0.00';

      // Table turnover (proxy: orders / active tables)
      const tableTurnover = activeTables === 0
        ? ZERO
        : new Prisma.Decimal(orderCount).div(activeTables)
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

      // Cash
      const totalCollected = [...acc.cashByMethod.values()].reduce(
        (t, amt) => t.add(amt), ZERO,
      );
      const cashAmount = acc.cashByMethod.get(CashPaymentMethod.CASH) ?? ZERO;
      const cashRatioPct = pct(cashAmount, totalCollected);

      return {
        currency,
        pnl: {
          revenue: {
            sales: money(acc.salesAmount),
            service: money(acc.serviceAmount),
            total: money(acc.revenueTotal),
            consumptionTax: money(acc.taxAmount),
          },
          cogs: {
            real: money(acc.cogsReal),
            theoretical: money(acc.cogsTheoretical),
            variance: money(cogsVariance),
          },
          grossProfit: money(grossProfit),
          operatingExpenses: {
            fixed: money(acc.fixedCosts),
            variable: money(acc.variableCosts),
            payroll: money(acc.payroll),
            total: money(operatingExpensesTotal),
            hasData: hasOperationalData,
          },
          operatingProfit: money(operatingProfit),
          netProfit: money(netProfit),
        },
        kpis: {
          margins: {
            grossMarginPct: pct(grossProfit, acc.revenueTotal),
            operatingMarginPct: pct(operatingProfit, acc.revenueTotal),
            netMarginPct: pct(netProfit, acc.revenueTotal),
            foodCostPct: pct(acc.cogsReal, acc.revenueTotal),
            primeCostPct: pct(acc.cogsReal.add(acc.payroll), acc.revenueTotal),
            wastePct: pct(cogsVariance, acc.cogsTheoretical),
          },
          costStructure: {
            laborCostPct: pct(acc.payroll, acc.revenueTotal),
            rentCostPct: pct(acc.fixedCosts, acc.revenueTotal),
            variableCostPct: pct(acc.variableCosts, acc.revenueTotal),
            totalCostPct: pct(acc.cogsReal.add(operatingExpensesTotal), acc.revenueTotal),
          },
          breakEven: {
            revenue: money(breakEvenRevenue),
            orders: breakEvenOrders.toFixed(2),
            marginOfSafetyPct,
            feasible: breakEvenFeasible,
          },
          volume: {
            orderCount,
            avgTicket: money(avgTicket),
            totalGuests: acc.totalGuests,
            avgGuestsPerOrder: money(avgGuestsPerOrder),
            revenuePerGuest: money(revenuePerGuest),
            unitsSold: acc.unitsSold,
            hasGuestData: acc.hasGuests,
          },
          operations: {
            tableTurnover: tableTurnover.toFixed(2),
            avgKitchenTimeMinutes,
            hasDispatchData,
            reservationCompletionRatePct,
            totalReservations,
          },
          cash: {
            totalCollected: money(totalCollected),
            byMethod: {
              [CashPaymentMethod.CASH]: money(acc.cashByMethod.get(CashPaymentMethod.CASH) ?? ZERO),
              [CashPaymentMethod.CARD]: money(acc.cashByMethod.get(CashPaymentMethod.CARD) ?? ZERO),
              [CashPaymentMethod.TRANSFER]: money(acc.cashByMethod.get(CashPaymentMethod.TRANSFER) ?? ZERO),
              [CashPaymentMethod.OTHER]: money(acc.cashByMethod.get(CashPaymentMethod.OTHER) ?? ZERO),
            },
            cashRatioPct,
            cashReconciliationDifference,
            hasClosedSessions,
          },
        },
        buckets: allBuckets.map(key => {
          const b = acc.buckets.get(key) ?? emptyBucket();
          const bucketGross = b.revenue.sub(b.cogsReal);
          const bucketOperating = bucketGross.sub(b.operatingExpenses);
          return {
            period: key,
            revenue: money(b.revenue),
            grossProfit: money(bucketGross),
            operatingProfit: money(bucketOperating),
            netProfit: money(bucketOperating),
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