import prisma from '../../lib/prisma';

interface Query { from: Date; to: Date }

async function safe<T>(section: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); }
  catch (e: any) { console.error(`[salesReport] FALLO en "${section}":`, e?.message ?? e); return fallback; }
}

async function computeMetrics(from: Date, to: Date) {
  const orders = await safe('salesOrder.findMany (settled)', () =>
    prisma.salesOrder.findMany({
      where: { status: 'SETTLED', settledAt: { gte: from, lte: to } },
      include: { items: true },
    }), [] as any[]);

  const openCount = await safe('salesOrder.count (open)', () =>
    prisma.salesOrder.count({ where: { status: 'OPEN', createdAt: { gte: from, lte: to } } }), 0);

  const voidedCount = await safe('salesOrder.count (voided)', () =>
    prisma.salesOrder.count({ where: { status: 'VOIDED', voidedAt: { gte: from, lte: to } } }), 0);

  const preInvoices = await safe('salesPreInvoice.findMany', () =>
    prisma.salesPreInvoice.findMany({
      where: { status: 'ACTIVE', generatedAt: { gte: from, lte: to } },
      select: { salesAmountSnapshot: true, consumptionTaxAmountSnapshot: true, serviceAmountSnapshot: true },
    }), [] as any[]);

  const totalSales = preInvoices.reduce((s, p) => s + Number(p.salesAmountSnapshot), 0);
  const totalTax = preInvoices.reduce((s, p) => s + Number(p.consumptionTaxAmountSnapshot), 0);
  const totalService = preInvoices.reduce((s, p) => s + Number(p.serviceAmountSnapshot), 0);

  const itemsMap = new Map<number, { name: string; category: string; quantity: number; revenue: number }>();
  const categoriesMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  const salesByDayMap = new Map<string, { orders: number; revenue: number }>();
  const addonsMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  let totalItems = 0;

  for (const order of orders) {
    let orderRevenue = 0;
    for (const item of order.items) {
      const qty = item.quantity;
      const unitPrice = Number(item.unitPriceSnapshot);
      const revenue = unitPrice * qty;
      totalItems += qty;
      orderRevenue += revenue;
      const e = itemsMap.get(item.menuItemId) ?? { name: item.menuItemNameSnapshot, category: item.menuCategoryNameSnapshot ?? 'Sin categoría', quantity: 0, revenue: 0 };
      e.quantity += qty; e.revenue += revenue; itemsMap.set(item.menuItemId, e);
      const catName = item.menuCategoryNameSnapshot ?? 'Sin categoría';
      const cat = categoriesMap.get(catName) ?? { name: catName, quantity: 0, revenue: 0 };
      cat.quantity += qty; cat.revenue += revenue; categoriesMap.set(catName, cat);
      if (item.parentItemId !== null) {
        const ad = addonsMap.get(item.menuItemNameSnapshot) ?? { name: item.menuItemNameSnapshot, quantity: 0, revenue: 0 };
        ad.quantity += qty; ad.revenue += revenue; addonsMap.set(item.menuItemNameSnapshot, ad);
      }
    }
    if (order.settledAt) {
      const day = order.settledAt.toISOString().slice(0, 10);
      const d = salesByDayMap.get(day) ?? { orders: 0, revenue: 0 };
      d.orders++; d.revenue += orderRevenue; salesByDayMap.set(day, d);
    }
  }

  const paymentMethods = await safe('cashPayment.findMany', async () => {
    const rows = await prisma.cashPayment.findMany({ where: { receivedAt: { gte: from, lte: to } } });
    const m = new Map<string, { method: string; count: number; amount: number }>();
    for (const p of rows) {
      const k = String(p.method);
      const e = m.get(k) ?? { method: k, count: 0, amount: 0 };
      e.count++; e.amount += Number(p.amount); m.set(k, e);
    }
    return Array.from(m.values()).sort((a, b) => b.amount - a.amount);
  }, [] as any[]);

  const topTables = await safe('diningTable.findMany', async () => {
    const tables = await prisma.diningTable.findMany({
      select: {
        code: true, area: true,
        salesOrders: {
          where: { status: 'SETTLED', settledAt: { gte: from, lte: to } },
          select: { items: { select: { unitPriceSnapshot: true, quantity: true } } },
        },
      },
    });
    return tables.map((t) => ({
      code: t.code, area: t.area ?? '—', orders: t.salesOrders.length,
      revenue: t.salesOrders.reduce((s, o) => s + o.items.reduce((s2, i) => s2 + Number(i.unitPriceSnapshot) * i.quantity, 0), 0),
    })).filter((t) => t.orders > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [] as any[]);

  const kitchenSLA = await safe('kitchenDispatch.findMany (SLA)', async () => {
    const dispatches = await prisma.kitchenDispatch.findMany({
      where: { deliveredAt: { gte: from, lte: to } },
      select: { dispatchedAt: true, readyAt: true, targetReadyAt: true },
    });
    const prepared = dispatches.filter((d) => d.readyAt !== null);
    const avg = prepared.length
      ? prepared.reduce((s, d) => s + (d.readyAt!.getTime() - d.dispatchedAt.getTime()) / 60000, 0) / prepared.length
      : 0;
    const onTime = dispatches.filter((d) => d.readyAt && d.readyAt <= d.targetReadyAt).length;
    return {
      totalDispatches: dispatches.length, avgPrepMinutes: avg,
      onTimeCount: onTime,
      onTimePercent: dispatches.length ? (onTime / dispatches.length) * 100 : 0,
      delayedCount: dispatches.length - onTime,
    };
  }, { totalDispatches: 0, avgPrepMinutes: 0, onTimeCount: 0, onTimePercent: 0, delayedCount: 0 });

  const reservations = await safe('reservation.findMany', async () => {
    const rows = await prisma.reservation.findMany({
      where: { scheduledAt: { gte: from, lte: to } },
      select: { status: true, reservationType: true },
    });
    const bs: Record<string, number> = {};
    const bt: Record<string, number> = {};
    for (const r of rows) {
      bs[r.status] = (bs[r.status] ?? 0) + 1;
      bt[r.reservationType] = (bt[r.reservationType] ?? 0) + 1;
    }
    return {
      total: rows.length,
      pending: bs['PENDING'] ?? 0,
      confirmed: bs['CONFIRMED'] ?? 0,
      completed: bs['COMPLETED'] ?? 0,
      cancelled: bs['CANCELLED'] ?? 0,
      completionRate: rows.length ? ((bs['COMPLETED'] ?? 0) / rows.length) * 100 : 0,
      byType: Object.entries(bt).map(([type, count]) => ({ type, count })),
    };
  }, { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0, completionRate: 0, byType: [] as any[] });

  const voidedOrders = await safe('salesOrder.findMany (voided)', async () => {
    const rows = await prisma.salesOrder.findMany({
      where: { status: 'VOIDED', voidedAt: { gte: from, lte: to } },
      include: {
        diningTable: { select: { code: true } },
        items: { select: { unitPriceSnapshot: true, quantity: true } },
      },
      orderBy: { voidedAt: 'desc' }, take: 20,
    });
    return rows.map((o) => ({
      id: o.id, tableCode: o.diningTable.code, voidedAt: o.voidedAt!,
      reason: o.cancellationReason ?? 'Sin motivo registrado',
      estimatedAmount: o.items.reduce((s, i) => s + Number(i.unitPriceSnapshot) * i.quantity, 0),
    }));
  }, [] as any[]);

  const cashSessionsSummary = await safe('cashSession.findMany', async () => {
    const rows = await prisma.cashSession.findMany({
      where: { status: 'CLOSED', closedAt: { gte: from, lte: to } },
      include: { cashRegister: { select: { name: true } } },
      orderBy: { closedAt: 'desc' }, take: 20,
    });
    return {
      totalClosed: rows.length,
      totalWithDifference: rows.filter((s) => s.difference && Number(s.difference) !== 0).length,
      totalDifference: rows.reduce((s, c) => s + Number(c.difference ?? 0), 0),
      recent: rows.map((c) => ({
        id: c.id, register: c.cashRegister.name, closedAt: c.closedAt!,
        openingCash: Number(c.openingCash), expectedCash: Number(c.expectedCash ?? 0),
        countedCash: Number(c.countedCash ?? 0), difference: Number(c.difference ?? 0),
      })),
    };
  }, { totalClosed: 0, totalWithDifference: 0, totalDifference: 0, recent: [] as any[] });

  // ═══════════════════════════════════════════════════════════════════
  // SECCIONES NUEVAS — aquí, dentro de computeMetrics
  // ═══════════════════════════════════════════════════════════════════

  const analytics = await safe('salesOrder.findMany (analytics)', async () => {
    const ytdFrom = new Date(to.getFullYear(), 0, 1);

    const [periodOrders, ytdOrders] = await Promise.all([
      prisma.salesOrder.findMany({
        where: { status: 'SETTLED', settledAt: { gte: from, lte: to } },
        select: {
          id: true,
          settledAt: true,
          diningTable: { select: { code: true } },
          preInvoices: {
            where: { status: 'ACTIVE' }, take: 1, orderBy: { generatedAt: 'desc' },
            select: {
              salesAmountSnapshot: true, consumptionTaxAmountSnapshot: true,
              serviceAmountSnapshot: true, totalSnapshot: true,
            },
          },
          items: {
            select: {
              menuItemId: true, menuItemNameSnapshot: true,
              menuCategoryIdSnapshot: true, menuCategoryNameSnapshot: true,
              parentItemId: true, quantity: true,
              unitPriceSnapshot: true, unitSalesAmountSnapshot: true,
              unitConsumptionTaxAmountSnapshot: true,
            },
          },
        },
        orderBy: { settledAt: 'desc' },
      }),
      prisma.salesOrder.findMany({
        where: { status: 'SETTLED', settledAt: { gte: ytdFrom, lte: to } },
        select: {
          id: true,
          preInvoices: {
            where: { status: 'ACTIVE' }, take: 1, orderBy: { generatedAt: 'desc' },
            select: {
              salesAmountSnapshot: true, consumptionTaxAmountSnapshot: true,
              serviceAmountSnapshot: true, totalSnapshot: true,
            },
          },
          items: { select: { quantity: true } },
        },
      }),
    ]);

    const productMap = new Map<number, any>();
    const categoryMap = new Map<string, any>();
    let salesAmount = 0, tax = 0, service = 0, totalCollected = 0, unitsSold = 0;

    for (const order of periodOrders) {
      const inv = order.preInvoices[0];
      if (inv) {
        salesAmount += Number(inv.salesAmountSnapshot);
        tax += Number(inv.consumptionTaxAmountSnapshot);
        service += Number(inv.serviceAmountSnapshot);
        totalCollected += Number(inv.totalSnapshot);
      }
      for (const it of order.items) {
        unitsSold += it.quantity;
        const lineSales = Number(it.unitSalesAmountSnapshot) * it.quantity;
        const lineTax = Number(it.unitConsumptionTaxAmountSnapshot) * it.quantity;
        const lineGross = Number(it.unitPriceSnapshot) * it.quantity;

        if (it.parentItemId === null) {
          const e = productMap.get(it.menuItemId) ?? {
            menuItemId: it.menuItemId, name: it.menuItemNameSnapshot,
            quantity: 0, salesAmount: 0, consumptionTaxAmount: 0,
            grossAmount: 0, consumptionSubtotal: 0,
          };
          e.quantity += it.quantity;
          e.salesAmount += lineSales;
          e.consumptionTaxAmount += lineTax;
          e.grossAmount += lineGross;
          e.consumptionSubtotal += lineSales + lineTax;
          productMap.set(it.menuItemId, e);
        }

        const catKey = `${it.menuCategoryIdSnapshot ?? 'null'}:${it.menuCategoryNameSnapshot ?? 'Sin categoría'}`;
        const cat = categoryMap.get(catKey) ?? {
          categoryId: it.menuCategoryIdSnapshot,
          categoryName: it.menuCategoryNameSnapshot ?? 'Sin categoría',
          quantity: 0, salesAmount: 0, consumptionTaxAmount: 0,
          grossAmount: 0, consumptionSubtotal: 0,
        };
        cat.quantity += it.quantity;
        cat.salesAmount += lineSales;
        cat.consumptionTaxAmount += lineTax;
        cat.grossAmount += lineGross;
        cat.consumptionSubtotal += lineSales + lineTax;
        categoryMap.set(catKey, cat);
      }
    }

    let ytdSales = 0, ytdTax = 0, ytdService = 0, ytdTotal = 0, ytdUnits = 0;
    for (const order of ytdOrders) {
      const inv = order.preInvoices[0];
      if (inv) {
        ytdSales += Number(inv.salesAmountSnapshot);
        ytdTax += Number(inv.consumptionTaxAmountSnapshot);
        ytdService += Number(inv.serviceAmountSnapshot);
        ytdTotal += Number(inv.totalSnapshot);
      }
      ytdUnits += order.items.reduce((s: number, i: any) => s + i.quantity, 0);
    }

    const orderDetails = periodOrders.slice(0, 20).map(order => {
      const inv = order.preInvoices[0];
      return {
        settledAt: order.settledAt?.toISOString() ?? '',
        orderId: order.id,
        table: order.diningTable.code,
        items: order.items.map((it: any) => ({
          name: it.menuItemNameSnapshot,
          quantity: it.quantity,
          isAddition: it.parentItemId !== null,
        })),
        salesAmount: inv ? Number(inv.salesAmountSnapshot) : 0,
        consumptionTaxAmount: inv ? Number(inv.consumptionTaxAmountSnapshot) : 0,
        serviceAmount: inv ? Number(inv.serviceAmountSnapshot) : 0,
        totalCollected: inv ? Number(inv.totalSnapshot) : 0,
        currency: 'COP',
      };
    });

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      ytd: { from: ytdFrom.toISOString(), to: to.toISOString() },
      summary: { salesAmount, consumptionTaxAmount: tax, serviceAmount: service, totalCollected, closedOrders: periodOrders.length, unitsSold },
      ytdSummary: { salesAmount: ytdSales, consumptionTaxAmount: ytdTax, serviceAmount: ytdService, totalCollected: ytdTotal, closedOrders: ytdOrders.length, unitsSold: ytdUnits },
      products: Array.from(productMap.values()).sort((a, b) => b.salesAmount - a.salesAmount),
      categories: Array.from(categoryMap.values()).sort((a, b) => b.salesAmount - a.salesAmount),
      orderDetails,
    };
  }, {
    period: { from: from.toISOString(), to: to.toISOString() },
    ytd: { from: from.toISOString(), to: to.toISOString() },
    summary: { salesAmount: 0, consumptionTaxAmount: 0, serviceAmount: 0, totalCollected: 0, closedOrders: 0, unitsSold: 0 },
    ytdSummary: { salesAmount: 0, consumptionTaxAmount: 0, serviceAmount: 0, totalCollected: 0, closedOrders: 0, unitsSold: 0 },
    products: [], categories: [], orderDetails: [],
  });

  const profitabilityByProduct = await safe('salesOrderItem.findMany (profitability)', async () => {
    const items = await prisma.salesOrderItem.findMany({
      where: {
        salesOrder: { status: 'SETTLED', settledAt: { gte: from, lte: to } },
        parentItemId: null,
      },
      select: {
        menuItemId: true,
        menuItemNameSnapshot: true,
        menuCategoryNameSnapshot: true,
        quantity: true,
        unitPriceSnapshot: true,
        menuItemPrice: { select: { totalCostSnapshot: true } },
      },
    });

    const map = new Map<number, any>();
    for (const item of items) {
      const revenue = Number(item.unitPriceSnapshot) * item.quantity;
      const cost = Number(item.menuItemPrice?.totalCostSnapshot ?? 0) * item.quantity;
      const margin = revenue - cost;
      const e = map.get(item.menuItemId) ?? {
        name: item.menuItemNameSnapshot,
        category: item.menuCategoryNameSnapshot ?? 'Sin categoría',
        quantity: 0, revenue: 0, cost: 0, margin: 0,
      };
      e.quantity += item.quantity;
      e.revenue += revenue;
      e.cost += cost;
      e.margin += margin;
      map.set(item.menuItemId, e);
    }

    const list = Array.from(map.values());
    const totalRevenue = list.reduce((s, x) => s + x.revenue, 0);
    const totalCost = list.reduce((s, x) => s + x.cost, 0);
    const totalMargin = totalRevenue - totalCost;

    return {
      totalRevenue, totalCost, totalMargin,
      marginPct: totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0,
      items: list.map(x => ({
        ...x,
        marginPct: x.revenue > 0 ? (x.margin / x.revenue) * 100 : 0,
        contributionPct: totalMargin > 0 ? (x.margin / totalMargin) * 100 : 0,
      })).sort((a, b) => b.margin - a.margin),
    };
  }, { totalRevenue: 0, totalCost: 0, totalMargin: 0, marginPct: 0, items: [] });

  // ═══════════════════════════════════════════════════════════════════
  // RETURN de computeMetrics — incluye las secciones nuevas al final
  // ═══════════════════════════════════════════════════════════════════

  const orderCount = orders.length;
  return {
    summary: {
      orderCount, openCount, voidedCount,
      totalSales, totalTax, totalService, totalItems,
      avgTicket: orderCount > 0 ? totalSales / orderCount : 0,
      avgItemsPerOrder: orderCount > 0 ? totalItems / orderCount : 0,
    },
    items: Array.from(itemsMap.values()).sort((a, b) => b.revenue - a.revenue),
    categories: Array.from(categoriesMap.values()).sort((a, b) => b.revenue - a.revenue),
    paymentMethods,
    salesByDay: Array.from(salesByDayMap.entries()).map(([date, d]) => ({ date, ...d })).sort((a, b) => a.date.localeCompare(b.date)),
    topTables, kitchenSLA, reservations,
    addons: Array.from(addonsMap.values()).sort((a, b) => b.revenue - a.revenue),
    voidedOrders, cashSessionsSummary,
    analytics,               // ← NUEVO
    profitabilityByProduct,  // ← NUEVO
  };
}

export async function buildSalesReport({ from, to }: Query) {
  const durationMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  const [curr, prev] = await Promise.all([computeMetrics(from, to), computeMetrics(prevFrom, prevTo)]);
  return {
    period: { from, to },
    previousPeriod: { from: prevFrom, to: prevTo },
    ...curr,
    previousSummary: prev.summary,
  };
}

export type SalesReport = Awaited<ReturnType<typeof buildSalesReport>>;