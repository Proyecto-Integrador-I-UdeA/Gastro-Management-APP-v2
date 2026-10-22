import {
  CashPaymentMethod,
  Prisma,
  PrismaClient,
  SalesOrderStatus,
  SalesPaymentStatus,
  SalesPreInvoiceStatus,
} from '@prisma/client';
import prisma from '../../lib/prisma';
import type { IncomeSummaryQuery } from '../../schemas/finance/incomeSchema';

type IncomeClient = PrismaClient | Prisma.TransactionClient;

export type AccrualRow = {
  invoiceId: number;
  orderId: number;
  settledAt: Date;
  currency: string;
  salesAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  serviceAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
};

export type CashRow = {
  paymentId: number;
  orderId: number;
  receivedAt: Date;
  method: CashPaymentMethod;
  currency: string;
  salesAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  serviceAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
};

export interface IncomeDataSource {
  loadAccrualRows(start: Date, end: Date): Promise<AccrualRow[]>;
  loadCashRows(start: Date, end: Date): Promise<CashRow[]>;
}

export class IncomeOperationError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'IncomeOperationError';
  }
}

const ZERO = new Prisma.Decimal(0);
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const PAYMENT_METHODS: CashPaymentMethod[] = [
  CashPaymentMethod.CASH,
  CashPaymentMethod.CARD,
  CashPaymentMethod.TRANSFER,
  CashPaymentMethod.OTHER,
];

function money(value: Prisma.Decimal.Value): string {
  return new Prisma.Decimal(value).toFixed(2);
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

function mondayOf(ymd: string): string {
  const date = new Date(`${ymd}T00:00:00.000Z`);
  const dayOfWeek = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayOfWeek);
  return date.toISOString().slice(0, 10);
}

function bucketKey(
  date: Date,
  granularity: IncomeSummaryQuery['granularity'],
): string {
  const ymd = bogotaYmd(date);
  switch (granularity) {
    case 'day': return ymd;
    case 'week': return mondayOf(ymd);
    case 'month': return ymd.slice(0, 7);
    case 'year': return ymd.slice(0, 4);
  }
}

function enumerateBuckets(
  from: string,
  to: string,
  granularity: IncomeSummaryQuery['granularity'],
): string[] {
  const result: string[] = [];
  if (granularity === 'day') {
    let cursor = from;
    while (cursor <= to) { result.push(cursor); cursor = addDays(cursor, 1); }
    return result;
  }
  if (granularity === 'week') {
    let cursor = mondayOf(from);
    while (cursor <= to) { result.push(cursor); cursor = addDays(cursor, 7); }
    return result;
  }
  if (granularity === 'month') {
    let year = Number(from.slice(0, 4));
    let month = Number(from.slice(5, 7));
    const lastMonth = to.slice(0, 7);
    while (true) {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      if (key > lastMonth) break;
      result.push(key);
      month += 1;
      if (month > 12) { month = 1; year += 1; }
    }
    return result;
  }
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y += 1) {
    result.push(String(y));
  }
  return result;
}

type BucketAccumulator = {
  salesAmount: Prisma.Decimal;
  orderIds: Set<number>;
};

type CurrencyAccumulator = {
  salesAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  serviceAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  orderIds: Set<number>;
  buckets: Map<string, BucketAccumulator>;
  byPaymentMethod: Map<CashPaymentMethod, Prisma.Decimal>;
};

function emptyAccumulator(): CurrencyAccumulator {
  return {
    salesAmount: ZERO,
    taxAmount: ZERO,
    serviceAmount: ZERO,
    totalAmount: ZERO,
    orderIds: new Set(),
    buckets: new Map(),
    byPaymentMethod: new Map(PAYMENT_METHODS.map(method => [method, ZERO])),
  };
}

function bucketOf(acc: CurrencyAccumulator, key: string): BucketAccumulator {
  const current = acc.buckets.get(key) ?? { salesAmount: ZERO, orderIds: new Set<number>() };
  acc.buckets.set(key, current);
  return current;
}

async function loadAccrualRowsFromDb(
  client: IncomeClient,
  start: Date,
  end: Date,
): Promise<AccrualRow[]> {
  const startLit = utcTimestampLiteral(start);
  const endLit = utcTimestampLiteral(end);
  return client.$queryRaw<AccrualRow[]>`
    SELECT
      spi."id"                        AS "invoiceId",
      so."id"                         AS "orderId",
      so."settledAt"                  AS "settledAt",
      COALESCE(
        (SELECT "currencySnapshot" FROM "sales_order_items" WHERE "salesOrderId" = so."id" LIMIT 1),
        'COP'
      )                               AS "currency",
      spi."salesAmountSnapshot"       AS "salesAmount",
      spi."consumptionTaxAmountSnapshot" AS "taxAmount",
      spi."serviceAmountSnapshot"     AS "serviceAmount",
      spi."totalSnapshot"             AS "totalAmount"
    FROM "sales_pre_invoices" spi
    INNER JOIN "sales_orders" so ON so."id" = spi."salesOrderId"
    WHERE spi."status" = ${SalesPreInvoiceStatus.ACTIVE}::"SalesPreInvoiceStatus"
      AND so."status" = ${SalesOrderStatus.SETTLED}::"SalesOrderStatus"
      AND so."paymentStatus" = ${SalesPaymentStatus.PAID}::"SalesPaymentStatus"
      AND so."settledAt" >= ${startLit}::timestamp
      AND so."settledAt" < ${endLit}::timestamp
  `;
}

async function loadCashRowsFromDb(
  client: IncomeClient,
  start: Date,
  end: Date,
): Promise<CashRow[]> {
  const startLit = utcTimestampLiteral(start);
  const endLit = utcTimestampLiteral(end);
  return client.$queryRaw<CashRow[]>`
    SELECT
      cp."id"                           AS "paymentId",
      so."id"                           AS "orderId",
      cp."receivedAt"                   AS "receivedAt",
      cp."method"                       AS "method",
      COALESCE(
        (SELECT "currencySnapshot" FROM "sales_order_items" WHERE "salesOrderId" = so."id" LIMIT 1),
        'COP'
      )                                 AS "currency",
      cp."salesAmount"                  AS "salesAmount",
      cp."consumptionTaxAmount"         AS "taxAmount",
      cp."serviceAmount"                AS "serviceAmount",
      cp."amount"                       AS "totalAmount"
    FROM "cash_payments" cp
    INNER JOIN "sales_pre_invoices" spi ON spi."id" = cp."preInvoiceId"
    INNER JOIN "sales_orders" so ON so."id" = spi."salesOrderId"
    WHERE cp."receivedAt" >= ${startLit}::timestamp
      AND cp."receivedAt" < ${endLit}::timestamp
  `;
}

export function createPrismaIncomeDataSource(
  client: IncomeClient = prisma,
): IncomeDataSource {
  return {
    loadAccrualRows: (start, end) => loadAccrualRowsFromDb(client, start, end),
    loadCashRows: (start, end) => loadCashRowsFromDb(client, start, end),
  };
}

export type IncomeSummaryResponse = {
  period: {
    from: string;
    to: string;
    recognition: IncomeSummaryQuery['recognition'];
    granularity: IncomeSummaryQuery['granularity'];
    includeService: boolean;
  };
  currencies: Array<{
    currency: string;
    totals: {
      salesAmount: string;
      consumptionTaxAmount: string;
      serviceAmount: string;
      totalCollected: string;
      orderCount: number;
      avgTicket: string;
      operationalIncome: string;
    };
    buckets: Array<{
      period: string;
      salesAmount: string;
      orderCount: number;
    }>;
    byPaymentMethod?: Record<CashPaymentMethod, string>;
  }>;
};

export async function getIncomeSummary(
  query: IncomeSummaryQuery,
  source: IncomeDataSource = createPrismaIncomeDataSource(),
): Promise<IncomeSummaryResponse> {
  const start = bogotaStart(query.from);
  const end = bogotaStart(addDays(query.to, 1));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new IncomeOperationError('INVALID_DATE_RANGE', 400, 'Rango de fechas inválido');
  }

  const accumulators = new Map<string, CurrencyAccumulator>();
  const accumFor = (currency: string): CurrencyAccumulator => {
    const existing = accumulators.get(currency);
    if (existing) return existing;
    const created = emptyAccumulator();
    accumulators.set(currency, created);
    return created;
  };

  if (query.recognition === 'accrual') {
    const rows = await source.loadAccrualRows(start, end);
    for (const row of rows) {
      const acc = accumFor(row.currency);
      acc.salesAmount = acc.salesAmount.add(row.salesAmount);
      acc.taxAmount = acc.taxAmount.add(row.taxAmount);
      acc.serviceAmount = acc.serviceAmount.add(row.serviceAmount);
      acc.totalAmount = acc.totalAmount.add(row.totalAmount);
      acc.orderIds.add(row.orderId);
      const bucket = bucketOf(acc, bucketKey(row.settledAt, query.granularity));
      bucket.salesAmount = bucket.salesAmount.add(row.salesAmount);
      bucket.orderIds.add(row.orderId);
    }
  } else {
    const rows = await source.loadCashRows(start, end);
    for (const row of rows) {
      const acc = accumFor(row.currency);
      acc.salesAmount = acc.salesAmount.add(row.salesAmount);
      acc.taxAmount = acc.taxAmount.add(row.taxAmount);
      acc.serviceAmount = acc.serviceAmount.add(row.serviceAmount);
      acc.totalAmount = acc.totalAmount.add(row.totalAmount);
      acc.orderIds.add(row.orderId);
      const bucket = bucketOf(acc, bucketKey(row.receivedAt, query.granularity));
      bucket.salesAmount = bucket.salesAmount.add(row.salesAmount);
      bucket.orderIds.add(row.orderId);
      acc.byPaymentMethod.set(
        row.method,
        (acc.byPaymentMethod.get(row.method) ?? ZERO).add(row.totalAmount),
      );
    }
  }

  const allBuckets = enumerateBuckets(query.from, query.to, query.granularity);

  const currencies = [...accumulators.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, acc]): IncomeSummaryResponse['currencies'][number] => {
      const orderCount = acc.orderIds.size;
      const avgTicket = orderCount === 0
        ? ZERO
        : acc.salesAmount
            .div(orderCount)
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const operationalIncome = query.includeService
        ? acc.salesAmount.add(acc.serviceAmount)
        : acc.salesAmount;

      return {
        currency,
        totals: {
          salesAmount: money(acc.salesAmount),
          consumptionTaxAmount: money(acc.taxAmount),
          serviceAmount: money(acc.serviceAmount),
          totalCollected: money(acc.totalAmount),
          orderCount,
          avgTicket: money(avgTicket),
          operationalIncome: money(operationalIncome),
        },
        buckets: allBuckets.map(key => {
          const bucket = acc.buckets.get(key);
          return {
            period: key,
            salesAmount: money(bucket?.salesAmount ?? ZERO),
            orderCount: bucket?.orderIds.size ?? 0,
          };
        }),
        ...(query.recognition === 'cash'
          ? {
              byPaymentMethod: Object.fromEntries(
                PAYMENT_METHODS.map(method => [
                  method,
                  money(acc.byPaymentMethod.get(method) ?? ZERO),
                ]),
              ) as Record<CashPaymentMethod, string>,
            }
          : {}),
      };
    });

  return {
    period: {
      from: query.from,
      to: query.to,
      recognition: query.recognition,
      granularity: query.granularity,
      includeService: query.includeService,
    },
    currencies,
  };
}