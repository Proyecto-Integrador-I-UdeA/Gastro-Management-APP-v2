import { Prisma, PrismaClient, SalesOrderStatus, SalesPaymentStatus } from '@prisma/client';
import prisma from '../../lib/prisma';
import { SalesOperationError } from './salesOrderService';
import type { SalesAnalyticsQuery } from '../../schemas/salesAnalyticsSchema';

type AnalyticsClient = PrismaClient | Prisma.TransactionClient;
const ZERO = new Prisma.Decimal(0);
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

function decimal(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value);
}

function money(value: Prisma.Decimal.Value) {
  return decimal(value).toFixed(2);
}

function ymdFromDate(date: Date) {
  return new Date(date.getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

function parseYmd(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new SalesOperationError('INVALID_ANALYTICS_DATE', 400, 'La fecha no es válida');
  }
  return date;
}

function bogotaStart(value: string) {
  parseYmd(value);
  return new Date(`${value}T00:00:00.000-05:00`);
}

function addDays(value: string, days: number) {
  const date = parseYmd(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function startOfMonth(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function nextMonth(value: string) {
  const date = parseYmd(`${value.slice(0, 7)}-01`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function currentBogotaDate() {
  return ymdFromDate(new Date());
}

function periodRange(query: SalesAnalyticsQuery) {
  const today = currentBogotaDate();
  let from = query.date ?? today;
  let to = addDays(from, 1);
  let selected: { date?: string; week?: string; month?: string; year?: string } = { date: from };

  if (query.period === 'week') {
    const reference = query.week ?? today;
    const referenceDate = parseYmd(reference);
    const mondayOffset = (referenceDate.getUTCDay() + 6) % 7;
    from = addDays(reference, -mondayOffset);
    to = addDays(from, 7);
    selected = { week: reference };
  } else if (query.period === 'month') {
    const month = query.month ?? today.slice(0, 7);
    parseYmd(`${month}-01`);
    from = `${month}-01`;
    to = nextMonth(from);
    selected = { month };
  } else if (query.period === 'year') {
    const year = query.year ?? today.slice(0, 4);
    parseYmd(`${year}-01-01`);
    from = `${year}-01-01`;
    to = `${Number(year) + 1}-01-01`;
    selected = { year };
  } else if (query.period === 'custom') {
    from = query.from as string;
    to = addDays(query.to as string, 1);
    selected = {};
  }

  const start = bogotaStart(from);
  const end = bogotaStart(to);
  if (start >= end) throw new SalesOperationError('INVALID_ANALYTICS_DATE_RANGE', 400, 'El rango de fechas no es válido');
  return { from, to: addDays(to, -1), start, end, selected };
}

function yearToDateRange() {
  const today = currentBogotaDate();
  const yearStart = `${today.slice(0, 4)}-01-01`;
  return { from: yearStart, to: today, start: bogotaStart(yearStart), end: bogotaStart(addDays(today, 1)) };
}

const analyticsOrderSelect = {
  id: true,
  settledAt: true,
  diningTable: { select: { code: true } },
  items: {
    orderBy: { id: 'asc' as const },
    select: {
      id: true,
      menuItemId: true,
      menuItemNameSnapshot: true,
      menuCategoryIdSnapshot: true,
      menuCategoryNameSnapshot: true,
      parentItemId: true,
      quantity: true,
      unitPriceSnapshot: true,
      unitSalesAmountSnapshot: true,
      unitConsumptionTaxAmountSnapshot: true,
      currencySnapshot: true,
    },
  },
  preInvoices: {
    where: { status: 'ACTIVE' as const },
    take: 1,
    orderBy: { generatedAt: 'desc' as const },
    select: {
      salesAmountSnapshot: true,
      consumptionTaxAmountSnapshot: true,
      serviceAmountSnapshot: true,
      totalSnapshot: true,
    },
  },
} satisfies Prisma.SalesOrderSelect;

type AnalyticsOrder = Prisma.SalesOrderGetPayload<{ select: typeof analyticsOrderSelect }>;
type Line = AnalyticsOrder['items'][number];

const filterOptionOrderSelect = {
  settledAt: true,
  items: {
    select: {
      menuItemId: true,
      menuItemNameSnapshot: true,
      parentItemId: true,
      menuCategoryIdSnapshot: true,
      menuCategoryNameSnapshot: true,
    },
  },
} satisfies Prisma.SalesOrderSelect;

type FilterOptionOrder = Prisma.SalesOrderGetPayload<{ select: typeof filterOptionOrderSelect }>;

type Aggregate = {
  quantity: number;
  sales: Prisma.Decimal;
  tax: Prisma.Decimal;
  gross: Prisma.Decimal;
};

type CurrencyResult = {
  currency: string;
  summary: {
    salesAmount: string;
    consumptionTaxAmount: string;
    serviceAmount: string;
    totalCollected: string;
    closedOrders: number;
    unitsSold: number;
  };
  products: Array<{ menuItemId: number; name: string; quantity: number; salesAmount: string; consumptionTaxAmount: string; grossAmount: string; consumptionSubtotal: string }>;
  additions: Array<{ menuItemId: number; name: string; quantity: number; salesAmount: string; consumptionTaxAmount: string; grossAmount: string; consumptionSubtotal: string }>;
  categories: Array<{ categoryId: number | null; categoryName: string; quantity: number; salesAmount: string; consumptionTaxAmount: string; grossAmount: string; consumptionSubtotal: string }>;
  details: Array<{ settledAt: string; orderId: number; table: string; items: Array<{ name: string; quantity: number; isAddition: boolean }>; salesAmount: string; consumptionTaxAmount: string; serviceAmount: string; totalCollected: string; currency: string }>;
};

type AnalyticsFilterOptions = {
  products: Array<{ menuItemId: number; name: string }>;
  categories: Array<{ categoryId: number; name: string }>;
  years: number[];
};

function emptyAggregate(): Aggregate {
  return { quantity: 0, sales: ZERO, tax: ZERO, gross: ZERO };
}

function addLine(target: Aggregate, line: Line) {
  target.quantity += line.quantity;
  target.sales = target.sales.add(decimal(line.unitSalesAmountSnapshot).mul(line.quantity));
  target.tax = target.tax.add(decimal(line.unitConsumptionTaxAmountSnapshot).mul(line.quantity));
  target.gross = target.gross.add(decimal(line.unitPriceSnapshot).mul(line.quantity));
}

function serializeAggregate(key: { menuItemId: number; name: string }, aggregate: Aggregate) {
  const salesAmount = money(aggregate.sales);
  const consumptionTaxAmount = money(aggregate.tax);
  return {
    ...key,
    quantity: aggregate.quantity,
    salesAmount,
    consumptionTaxAmount,
    grossAmount: money(aggregate.gross),
    consumptionSubtotal: money(aggregate.sales.add(aggregate.tax)),
  };
}

function buildCurrencyResult(currency: string, orders: AnalyticsOrder[], matchingItems: Map<number, Line[]>) : CurrencyResult {
  const productMap = new Map<number, { name: string; aggregate: Aggregate }>();
  const additionMap = new Map<number, { name: string; aggregate: Aggregate }>();
  const categoryMap = new Map<string, { categoryId: number | null; categoryName: string; aggregate: Aggregate }>();
  let sales = ZERO;
  let tax = ZERO;
  let service = ZERO;
  let total = ZERO;
  let unitsSold = 0;

  const details = orders.map(order => {
    const invoice = order.preInvoices[0];
    const matched = matchingItems.get(order.id) ?? [];
    for (const line of matched) {
      const targetMap = line.parentItemId === null ? productMap : additionMap;
      const current = targetMap.get(line.menuItemId) ?? { name: line.menuItemNameSnapshot, aggregate: emptyAggregate() };
      addLine(current.aggregate, line);
      targetMap.set(line.menuItemId, current);
      const categoryKey = `${line.menuCategoryIdSnapshot ?? 'null'}:${line.menuCategoryNameSnapshot ?? 'Sin categoría'}`;
      const category = categoryMap.get(categoryKey) ?? { categoryId: line.menuCategoryIdSnapshot, categoryName: line.menuCategoryNameSnapshot ?? 'Sin categoría', aggregate: emptyAggregate() };
      addLine(category.aggregate, line);
      categoryMap.set(categoryKey, category);
    }
    unitsSold += order.items.reduce((total, item) => total + item.quantity, 0);

    const orderSales = invoice?.salesAmountSnapshot ?? ZERO;
    const orderTax = invoice?.consumptionTaxAmountSnapshot ?? ZERO;
    const orderService = invoice?.serviceAmountSnapshot ?? ZERO;
    const orderTotal = invoice?.totalSnapshot ?? decimal(orderSales).add(orderTax).add(orderService);
    sales = sales.add(orderSales);
    tax = tax.add(orderTax);
    service = service.add(orderService);
    total = total.add(orderTotal);
    return {
      settledAt: order.settledAt?.toISOString() ?? '',
      orderId: order.id,
      table: order.diningTable.code,
      items: order.items.map(item => ({ name: item.menuItemNameSnapshot, quantity: item.quantity, isAddition: item.parentItemId !== null })),
      salesAmount: money(orderSales),
      consumptionTaxAmount: money(orderTax),
      serviceAmount: money(orderService),
      totalCollected: money(orderTotal),
      currency,
    };
  });

  const serializeMap = (map: Map<number, { name: string; aggregate: Aggregate }>) => [...map.entries()]
    .map(([menuItemId, value]) => serializeAggregate({ menuItemId, name: value.name }, value.aggregate))
    .sort((a, b) => decimal(b.salesAmount).comparedTo(decimal(a.salesAmount)));
  const categories = [...categoryMap.values()].map(value => {
    const aggregate = serializeAggregate({ menuItemId: 0, name: value.categoryName }, value.aggregate);
    return { categoryId: value.categoryId, categoryName: value.categoryName, quantity: aggregate.quantity, salesAmount: aggregate.salesAmount, consumptionTaxAmount: aggregate.consumptionTaxAmount, grossAmount: aggregate.grossAmount, consumptionSubtotal: aggregate.consumptionSubtotal };
  }).sort((a, b) => decimal(b.salesAmount).comparedTo(decimal(a.salesAmount)));

  return {
    currency,
    summary: { salesAmount: money(sales), consumptionTaxAmount: money(tax), serviceAmount: money(service), totalCollected: money(total), closedOrders: orders.length, unitsSold },
    products: serializeMap(productMap),
    additions: serializeMap(additionMap),
    categories,
    details,
  };
}

async function loadOrders(client: AnalyticsClient, start: Date, end: Date) {
  return client.salesOrder.findMany({
    where: { status: SalesOrderStatus.SETTLED, paymentStatus: SalesPaymentStatus.PAID, settledAt: { gte: start, lt: end } },
    orderBy: [{ settledAt: 'asc' }, { id: 'asc' }],
    select: analyticsOrderSelect,
  });
}

async function loadFilterOptions(client: AnalyticsClient): Promise<AnalyticsFilterOptions> {
  const orders = await client.salesOrder.findMany({
    where: {
      status: SalesOrderStatus.SETTLED,
      paymentStatus: SalesPaymentStatus.PAID,
      settledAt: { not: null },
    },
    orderBy: [{ settledAt: 'desc' }, { id: 'desc' }],
    select: filterOptionOrderSelect,
  });
  const products = new Map<number, string>();
  const categories = new Map<number, string>();
  const years = new Set<number>([Number(currentBogotaDate().slice(0, 4))]);
  for (const order of orders as FilterOptionOrder[]) {
    if (order.settledAt) years.add(Number(ymdFromDate(order.settledAt).slice(0, 4)));
    for (const item of order.items) {
      if (item.parentItemId === null && !products.has(item.menuItemId)) products.set(item.menuItemId, item.menuItemNameSnapshot);
      if (item.menuCategoryIdSnapshot !== null && !categories.has(item.menuCategoryIdSnapshot)) {
        categories.set(item.menuCategoryIdSnapshot, item.menuCategoryNameSnapshot ?? 'Sin categoría');
      }
    }
  }
  return {
    products: [...products.entries()].map(([menuItemId, name]) => ({ menuItemId, name })).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    categories: [...categories.entries()].map(([categoryId, name]) => ({ categoryId, name })).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    years: [...years].sort((a, b) => b - a),
  };
}

type QualifiedOrder = { order: AnalyticsOrder; matchingItems: Line[] };

function groupByCurrency(orders: AnalyticsOrder[], itemFilter?: (line: Line) => boolean) {
  const groups = new Map<string, QualifiedOrder[]>();
  for (const order of orders) {
    const currencies = [...new Set(order.items.map(item => item.currencySnapshot))];
    if (currencies.length > 1) throw new SalesOperationError('ANALYTICS_CURRENCY_INCONSISTENT', 500, 'La orden contiene monedas inconsistentes');
    const currency = currencies[0] ?? 'UNKNOWN';
    const matching = itemFilter ? order.items.filter(itemFilter) : order.items;
    if (itemFilter && matching.length === 0) continue;
    groups.set(currency, [...(groups.get(currency) ?? []), { order, matchingItems: matching }]);
  }
  return groups;
}

function buildResults(orders: AnalyticsOrder[], itemFilter?: (line: Line) => boolean) {
  return [...groupByCurrency(orders, itemFilter).entries()].map(([currency, qualifiedOrders]) => {
    const completeOrders = qualifiedOrders.map(entry => entry.order);
    const matching = new Map(qualifiedOrders.map(entry => [entry.order.id, entry.matchingItems]));
    return buildCurrencyResult(currency, completeOrders, matching);
  });
}

export async function getSalesAnalytics(query: SalesAnalyticsQuery, client: AnalyticsClient = prisma) {
  const range = periodRange(query);
  const ytd = yearToDateRange();
  const [periodOrders, yearOrders, filterOptions] = await Promise.all([
    loadOrders(client, range.start, range.end),
    loadOrders(client, ytd.start, ytd.end),
    loadFilterOptions(client),
  ]);
  const itemFilter = query.menuItemId || query.categoryId
    ? (line: Line) => (query.menuItemId === undefined || line.menuItemId === query.menuItemId)
      && (query.categoryId === undefined || line.menuCategoryIdSnapshot === query.categoryId)
    : undefined;
  return {
    period: { preset: query.period, from: range.from, to: range.to, ...range.selected },
    currencies: buildResults(periodOrders, itemFilter),
    yearToDate: { from: ytd.from, to: ytd.to, currencies: buildResults(yearOrders) },
    filterOptions,
  };
}
