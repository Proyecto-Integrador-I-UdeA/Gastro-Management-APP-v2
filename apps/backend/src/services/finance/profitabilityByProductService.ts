import {
  Prisma,
  PrismaClient,
  SalesOrderStatus,
  SalesPaymentStatus,
  SalesPreInvoiceStatus,
} from '@prisma/client';
import prisma from '../../lib/prisma';
import type { ProfitabilityByProductQuery } from '../../schemas/finance/profitabilityByProductSchema';

// ─── Tipos internos ────────────────────────────────────────────────────────

type QueryClient = PrismaClient | Prisma.TransactionClient;

export type ProductLineRow = {
  orderId: number;
  settledAt: Date;
  currency: string;
  menuItemId: number;
  menuItemName: string;
  categoryId: number | null;
  categoryName: string | null;
  quantity: number;
  unitSalesAmount: Prisma.Decimal;
  unitBaseCost: Prisma.Decimal;
};

export type OrderRevenueRow = {
  orderId: number;
  settledAt: Date;
  currency: string;
  revenue: Prisma.Decimal;
};

export type ProfitabilityConfigRow = {
  key: string;
  value: string;
};

export interface ProfitabilityByProductDataSource {
  loadProductLines(start: Date, end: Date): Promise<ProductLineRow[]>;
  loadOrderRevenues(start: Date, end: Date): Promise<OrderRevenueRow[]>;
  loadConfig(keys: string[]): Promise<ProfitabilityConfigRow[]>;
}

// ─── Errores ───────────────────────────────────────────────────────────────

export class ProfitabilityByProductOperationError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ProfitabilityByProductOperationError';
  }
}

// ─── Utilidades ────────────────────────────────────────────────────────────

const ZERO = new Prisma.Decimal(0);
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

const DEFAULT_FOOD_COST_TARGET_PCT = new Prisma.Decimal(35);
const DEFAULT_MARGIN_TARGET_PCT = new Prisma.Decimal(65);

const CONFIG_KEY_FOOD_COST = 'finance.food_cost_target_pct';
const CONFIG_KEY_MARGIN = 'finance.product_margin_target_pct';

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

// ─── Carga de datos (Prisma) ───────────────────────────────────────────────

async function loadProductLinesFromDb(
  client: QueryClient,
  start: Date,
  end: Date,
): Promise<ProductLineRow[]> {
  const startLit = utcTimestampLiteral(start);
  const endLit = utcTimestampLiteral(end);
  return client.$queryRaw<ProductLineRow[]>`
    SELECT
      so."id"                                       AS "orderId",
      so."settledAt"                                AS "settledAt",
      soi."currencySnapshot"                        AS "currency",
      soi."menuItemId"                              AS "menuItemId",
      soi."menuItemNameSnapshot"                    AS "menuItemName",
      soi."menuCategoryIdSnapshot"                  AS "categoryId",
      soi."menuCategoryNameSnapshot"                AS "categoryName",
      soi."quantity"                                AS "quantity",
      soi."unitSalesAmountSnapshot"                 AS "unitSalesAmount",
      mip."baseCostSnapshot"                        AS "unitBaseCost"
    FROM "sales_order_items" soi
    INNER JOIN "sales_orders" so ON so."id" = soi."salesOrderId"
    INNER JOIN "menu_item_prices" mip ON mip."id" = soi."menuItemPriceId"
    WHERE so."status" = ${SalesOrderStatus.SETTLED}::"SalesOrderStatus"
      AND so."paymentStatus" = ${SalesPaymentStatus.PAID}::"SalesPaymentStatus"
      AND so."settledAt" >= ${startLit}::timestamp
      AND so."settledAt" < ${endLit}::timestamp
      AND soi."parentItemId" IS NULL
  `;
}

async function loadOrderRevenuesFromDb(
  client: QueryClient,
  start: Date,
  end: Date,
): Promise<OrderRevenueRow[]> {
  const startLit = utcTimestampLiteral(start);
  const endLit = utcTimestampLiteral(end);
  return client.$queryRaw<OrderRevenueRow[]>`
    SELECT
      so."id"                                       AS "orderId",
      so."settledAt"                                AS "settledAt",
      COALESCE(
        (SELECT "currencySnapshot" FROM "sales_order_items" WHERE "salesOrderId" = so."id" LIMIT 1),
        'COP'
      )                                             AS "currency",
      spi."salesAmountSnapshot"                     AS "revenue"
    FROM "sales_pre_invoices" spi
    INNER JOIN "sales_orders" so ON so."id" = spi."salesOrderId"
    WHERE spi."status" = ${SalesPreInvoiceStatus.ACTIVE}::"SalesPreInvoiceStatus"
      AND so."status" = ${SalesOrderStatus.SETTLED}::"SalesOrderStatus"
      AND so."paymentStatus" = ${SalesPaymentStatus.PAID}::"SalesPaymentStatus"
      AND so."settledAt" >= ${startLit}::timestamp
      AND so."settledAt" < ${endLit}::timestamp
  `;
}

async function loadConfigFromDb(
  client: QueryClient,
  keys: string[],
): Promise<ProfitabilityConfigRow[]> {
  return client.config.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  });
}

export function createPrismaProfitabilityByProductDataSource(
  client: QueryClient = prisma,
): ProfitabilityByProductDataSource {
  return {
    loadProductLines: (start, end) => loadProductLinesFromDb(client, start, end),
    loadOrderRevenues: (start, end) => loadOrderRevenuesFromDb(client, start, end),
    loadConfig: (keys) => loadConfigFromDb(client, keys),
  };
}

// ─── Contrato de salida ────────────────────────────────────────────────────

export type ProductProfitability = {
  menuItemId: number;
  menuItemName: string;
  categoryId: number | null;
  categoryName: string | null;
  unitsSold: number;
  orderCount: number;
  revenue: string;
  cogsTheoretical: string;
  grossProfit: string;
  grossMarginPct: string;
  foodCostPct: string;
  isBelowTarget: boolean;
};

export type CategoryProfitability = {
  categoryId: number | null;
  categoryName: string;
  unitsSold: number;
  productCount: number;
  revenue: string;
  cogsTheoretical: string;
  grossProfit: string;
  grossMarginPct: string;
  foodCostPct: string;
  productsBelowTarget: number;
};

export type ProfitabilityByProductResponse = {
  period: {
    from: string;
    to: string;
  };
  targets: {
    foodCostTargetPct: string;
    productMarginTargetPct: string;
  };
  totals: {
    currency: string;
    revenue: string;
    cogsTheoretical: string;
    grossProfit: string;
    grossMarginPct: string;
    foodCostPct: string;
    totalOrders: number;
    profitableOrders: number;
    profitableOrdersPct: string;
    totalProducts: number;
    productsBelowTarget: number;
    productsBelowTargetPct: string;
    totalUnitsSold: number;
  };
  categories: CategoryProfitability[];
  products: ProductProfitability[];
};

// ─── Función principal ─────────────────────────────────────────────────────

export async function getProfitabilityByProduct(
  query: ProfitabilityByProductQuery,
  source: ProfitabilityByProductDataSource = createPrismaProfitabilityByProductDataSource(),
): Promise<ProfitabilityByProductResponse> {
  const start = bogotaStart(query.from);
  const end = bogotaStart(addDays(query.to, 1));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new ProfitabilityByProductOperationError('INVALID_DATE_RANGE', 400, 'Rango de fechas inválido');
  }

  const [productLines, orderRevenues, configRows] = await Promise.all([
    source.loadProductLines(start, end),
    source.loadOrderRevenues(start, end),
    source.loadConfig([CONFIG_KEY_FOOD_COST, CONFIG_KEY_MARGIN]),
  ]);

  const configMap = new Map(configRows.map(r => [r.key, r.value]));

  function parseConfigDecimal(key: string, fallback: Prisma.Decimal): Prisma.Decimal {
    const raw = configMap.get(key);
    if (!raw) return fallback;
    try {
      const parsed = new Prisma.Decimal(raw);
      if (!parsed.isFinite() || parsed.lt(0) || parsed.gt(100)) return fallback;
      return parsed;
    } catch {
      return fallback;
    }
  }

  const foodCostTarget = parseConfigDecimal(CONFIG_KEY_FOOD_COST, DEFAULT_FOOD_COST_TARGET_PCT);
  const marginTarget = parseConfigDecimal(CONFIG_KEY_MARGIN, DEFAULT_MARGIN_TARGET_PCT);

  // ─── Agregados por producto ───
  type ProductAcc = {
    menuItemId: number;
    menuItemName: string;
    categoryId: number | null;
    categoryName: string | null;
    unitsSold: number;
    revenue: Prisma.Decimal;
    cogs: Prisma.Decimal;
    orderIds: Set<number>;
  };
  const productMap = new Map<number, ProductAcc>();
  let currency = 'COP';

  for (const line of productLines) {
    currency = line.currency;
    const current = productMap.get(line.menuItemId) ?? {
      menuItemId: line.menuItemId,
      menuItemName: line.menuItemName,
      categoryId: line.categoryId,
      categoryName: line.categoryName,
      unitsSold: 0,
      revenue: ZERO,
      cogs: ZERO,
      orderIds: new Set<number>(),
    };
    current.unitsSold += line.quantity;
    current.revenue = current.revenue.add(line.unitSalesAmount.mul(line.quantity));
    current.cogs = current.cogs.add(line.unitBaseCost.mul(line.quantity));
    current.orderIds.add(line.orderId);
    productMap.set(line.menuItemId, current);
  }

  // ─── Filtros opcionales (search / categoryId) ───
  const searchNormalized = query.search?.trim().toLowerCase() ?? '';
  let products: ProductProfitability[] = [...productMap.values()]
    .filter(acc => !query.categoryId || acc.categoryId === query.categoryId)
    .filter(acc => !searchNormalized || acc.menuItemName.toLowerCase().includes(searchNormalized))
    .map(acc => {
      const gross = acc.revenue.sub(acc.cogs);
      const foodCost = acc.revenue.isZero()
        ? ZERO
        : acc.cogs.mul(100).div(acc.revenue);
      return {
        menuItemId: acc.menuItemId,
        menuItemName: acc.menuItemName,
        categoryId: acc.categoryId,
        categoryName: acc.categoryName,
        unitsSold: acc.unitsSold,
        orderCount: acc.orderIds.size,
        revenue: money(acc.revenue),
        cogsTheoretical: money(acc.cogs),
        grossProfit: money(gross),
        grossMarginPct: pct(gross, acc.revenue),
        foodCostPct: pct(acc.cogs, acc.revenue),
        isBelowTarget: foodCost.gt(foodCostTarget),
      };
    })
    .sort((a, b) => Number(b.revenue) - Number(a.revenue));

  // ─── Agregados por categoría ───
  type CategoryAcc = {
    categoryId: number | null;
    categoryName: string;
    unitsSold: number;
    productIds: Set<number>;
    revenue: Prisma.Decimal;
    cogs: Prisma.Decimal;
    productsBelowTarget: number;
  };
  const categoryMap = new Map<string, CategoryAcc>();
  for (const p of products) {
    const key = `${p.categoryId ?? 'null'}:${p.categoryName ?? 'Sin categoría'}`;
    const current = categoryMap.get(key) ?? {
      categoryId: p.categoryId,
      categoryName: p.categoryName ?? 'Sin categoría',
      unitsSold: 0,
      productIds: new Set<number>(),
      revenue: ZERO,
      cogs: ZERO,
      productsBelowTarget: 0,
    };
    current.unitsSold += p.unitsSold;
    current.productIds.add(p.menuItemId);
    current.revenue = current.revenue.add(new Prisma.Decimal(p.revenue));
    current.cogs = current.cogs.add(new Prisma.Decimal(p.cogsTheoretical));
    if (p.isBelowTarget) current.productsBelowTarget += 1;
    categoryMap.set(key, current);
  }

  const categories: CategoryProfitability[] = [...categoryMap.values()]
    .map(acc => {
      const gross = acc.revenue.sub(acc.cogs);
      return {
        categoryId: acc.categoryId,
        categoryName: acc.categoryName,
        unitsSold: acc.unitsSold,
        productCount: acc.productIds.size,
        revenue: money(acc.revenue),
        cogsTheoretical: money(acc.cogs),
        grossProfit: money(gross),
        grossMarginPct: pct(gross, acc.revenue),
        foodCostPct: pct(acc.cogs, acc.revenue),
        productsBelowTarget: acc.productsBelowTarget,
      };
    })
    .sort((a, b) => Number(b.revenue) - Number(a.revenue));

  // ─── Totales y KPIs ejecutivos ───
  const totalRevenue = products.reduce(
    (sum, p) => sum.add(new Prisma.Decimal(p.revenue)),
    ZERO,
  );
  const totalCogs = products.reduce(
    (sum, p) => sum.add(new Prisma.Decimal(p.cogsTheoretical)),
    ZERO,
  );
  const totalGross = totalRevenue.sub(totalCogs);
  const totalUnits = products.reduce((sum, p) => sum + p.unitsSold, 0);
  const productsBelowTargetCount = products.filter(p => p.isBelowTarget).length;

  // Órdenes rentables: revenue − cogs agregado por orden > 0
  type OrderAcc = { revenue: Prisma.Decimal; cogs: Prisma.Decimal };
  const orderMap = new Map<number, OrderAcc>();
  for (const rev of orderRevenues) {
    orderMap.set(rev.orderId, { revenue: rev.revenue, cogs: ZERO });
  }
  for (const line of productLines) {
    const current = orderMap.get(line.orderId);
    if (!current) continue;
    current.cogs = current.cogs.add(line.unitBaseCost.mul(line.quantity));
  }
  const profitableOrders = [...orderMap.values()].filter(o => o.revenue.sub(o.cogs).gt(0)).length;
  const totalOrders = orderMap.size;

  return {
    period: {
      from: query.from,
      to: query.to,
    },
    targets: {
      foodCostTargetPct: foodCostTarget.toFixed(2),
      productMarginTargetPct: marginTarget.toFixed(2),
    },
    totals: {
      currency,
      revenue: money(totalRevenue),
      cogsTheoretical: money(totalCogs),
      grossProfit: money(totalGross),
      grossMarginPct: pct(totalGross, totalRevenue),
      foodCostPct: pct(totalCogs, totalRevenue),
      totalOrders,
      profitableOrders,
      profitableOrdersPct: totalOrders === 0
        ? '0.00'
        : pct(new Prisma.Decimal(profitableOrders), new Prisma.Decimal(totalOrders)),
      totalProducts: products.length,
      productsBelowTarget: productsBelowTargetCount,
      productsBelowTargetPct: products.length === 0
        ? '0.00'
        : pct(new Prisma.Decimal(productsBelowTargetCount), new Prisma.Decimal(products.length)),
      totalUnitsSold: totalUnits,
    },
    categories,
    products,
  };
}