import prisma from '../../lib/prisma';

interface Query { from: Date; to: Date }

function monthsInRange(from: Date, to: Date): string[] {
  const out: string[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cur <= end) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

async function computeMetrics(from: Date, to: Date) {
  const months = monthsInRange(from, to);

  // ── Despachos y consumo ──────────────────────────────────────────
  const dispatches = await prisma.kitchenDispatch.findMany({
    where: { dispatchedAt: { gte: from, lte: to } },
    include: {
      inventoryConsumption: {
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true } },
              recipe: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  let theoreticalCost = 0, wasteCost = 0, totalCost = 0, dispatchCount = 0, consumptionItemCount = 0;
  const productsMap = new Map<number, { name: string; unit: string; quantity: number; cost: number }>();
  const recipesMap = new Map<number, { name: string; quantity: number; cost: number }>();
  const warehousesMap = new Map<number, { cost: number; dispatches: number }>();

  for (const d of dispatches) {
    const c = d.inventoryConsumption;
    if (!c) continue;
    dispatchCount++;
    theoreticalCost += Number(c.theoreticalCost);
    wasteCost += Number(c.wasteCost);
    totalCost += Number(c.totalCost);

    for (const it of c.items) {
      consumptionItemCount++;
      const qty = Number(it.adjustedQuantity);
      const cost = Number(it.totalCost);

      const p = productsMap.get(it.productId) ?? { name: it.product.name, unit: it.unit, quantity: 0, cost: 0 };
      p.quantity += qty; p.cost += cost; productsMap.set(it.productId, p);

      if (it.recipe) {
        const r = recipesMap.get(it.recipe.id) ?? { name: it.recipe.name, quantity: 0, cost: 0 };
        r.quantity += qty; r.cost += cost; recipesMap.set(it.recipe.id, r);
      }
    }

    if (c.warehouseId) {
      const w = warehousesMap.get(c.warehouseId) ?? { cost: 0, dispatches: 0 };
      w.cost += Number(c.totalCost); w.dispatches++; warehousesMap.set(c.warehouseId, w);
    }
  }

  let warehouses: Array<{ name: string; cost: number; dispatches: number }> = [];
  if (warehousesMap.size > 0) {
    const whs = await prisma.warehouse.findMany({
      where: { id: { in: Array.from(warehousesMap.keys()) } },
      select: { id: true, name: true },
    });
    warehouses = whs.map((w) => {
      const e = warehousesMap.get(w.id)!;
      return { name: w.name, cost: e.cost, dispatches: e.dispatches };
    }).sort((a, b) => b.cost - a.cost);
  }

  // ── Movimientos de inventario por tipo ───────────────────────────
  const movements = await prisma.inventoryMovement.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { type: true, quantity: true, unitCost: true },
  });
  type MovSum = { count: number; totalValue: number; totalQuantity: number };
  const byType: Record<string, MovSum> = {};
  for (const m of movements) {
    byType[m.type] ??= { count: 0, totalValue: 0, totalQuantity: 0 };
    byType[m.type].count++;
    byType[m.type].totalQuantity += Number(m.quantity);
    if (m.unitCost) byType[m.type].totalValue += Number(m.quantity) * Number(m.unitCost);
  }
  const emptyMov: MovSum = { count: 0, totalValue: 0, totalQuantity: 0 };

  // ── Desperdicio real por producto ────────────────────────────────
  const wasteMovements = await prisma.inventoryMovement.findMany({
    where: { type: 'WASTE', createdAt: { gte: from, lte: to } },
    include: { product: { select: { id: true, name: true, unitOfMeasure: true } } },
  });
  const wasteMap = new Map<number, { name: string; unit: string; quantity: number; cost: number }>();
  for (const m of wasteMovements) {
    const e = wasteMap.get(m.productId) ?? {
      name: m.product.name, unit: m.product.unitOfMeasure, quantity: 0, cost: 0,
    };
    e.quantity += Number(m.quantity);
    if (m.unitCost) e.cost += Number(m.quantity) * Number(m.unitCost);
    wasteMap.set(m.productId, e);
  }

  // ── Estructura de costos del menú ────────────────────────────────
  const menuItems = await prisma.menuItem.findMany({
    where: { active: true },
    include: { prices: { where: { validUntil: null }, orderBy: { validFrom: 'desc' }, take: 1 } },
  });
  const menuAnalysis = menuItems.map((m) => {
    const price = m.prices[0];
    if (!price) return null;
    const cost = Number(price.totalCostSnapshot);
    const sale = Number(price.amount);
    return { name: m.name, cost, price: sale, margin: sale > 0 ? ((sale - cost) / sale) * 100 : 0 };
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  const menuStructure = {
    totalActiveItems: menuAnalysis.length,
    averageCost: menuAnalysis.length ? menuAnalysis.reduce((s, x) => s + x.cost, 0) / menuAnalysis.length : 0,
    averagePrice: menuAnalysis.length ? menuAnalysis.reduce((s, x) => s + x.price, 0) / menuAnalysis.length : 0,
    averageMargin: menuAnalysis.length ? menuAnalysis.reduce((s, x) => s + x.margin, 0) / menuAnalysis.length : 0,
    topByCost: [...menuAnalysis].sort((a, b) => b.cost - a.cost).slice(0, 10),
  };

  // ── Nómina ───────────────────────────────────────────────────────
  const payrollEntries = await prisma.financePayrollEntry.findMany({
    where: { period: { month: { in: months } } },
    select: { salary: true, extras: true, benefits: true, deductions: true, healthDeduction: true, pensionDeduction: true },
  });
  const payrollSummary = {
    entriesCount: payrollEntries.length,
    totalSalary: payrollEntries.reduce((s, e) => s + Number(e.salary), 0),
    totalExtras: payrollEntries.reduce((s, e) => s + Number(e.extras), 0),
    totalBenefits: payrollEntries.reduce((s, e) => s + Number(e.benefits), 0),
    totalDeductions: payrollEntries.reduce((s, e) => s + Number(e.deductions) + Number(e.healthDeduction) + Number(e.pensionDeduction), 0),
    grossTotal: 0,
  };
  payrollSummary.grossTotal = payrollSummary.totalSalary + payrollSummary.totalExtras + payrollSummary.totalBenefits;

  // ── Gastos operativos ────────────────────────────────────────────
  const expenses = await prisma.financeExpenseItem.findMany({
    where: { month: { in: months }, active: true },
    select: { kind: true, concept: true, amount: true },
  });
  const fixed = expenses.filter((e) => e.kind === 'FIXED').reduce((s, e) => s + Number(e.amount), 0);
  const variable = expenses.filter((e) => e.kind === 'VARIABLE').reduce((s, e) => s + Number(e.amount), 0);
  const operatingExpenses = {
    fixed, variable, total: fixed + variable,
    items: expenses.map((e) => ({ concept: e.concept, kind: e.kind, amount: Number(e.amount) })),
  };

  // ── Stock crítico (estado actual, no depende del período) ────────
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true, currentStock: true, minStock: true, unitCost: true, unitOfMeasure: true },
  });
  const criticalStock = products
    .filter((p) => p.minStock > 0 && p.currentStock < p.minStock)
    .map((p) => ({
      name: p.name,
      unit: p.unitOfMeasure,
      currentStock: p.currentStock,
      minStock: p.minStock,
      missing: p.minStock - p.currentStock,
      unitCost: p.unitCost,
      refillValue: (p.minStock - p.currentStock) * p.unitCost,
    }))
    .sort((a, b) => b.refillValue - a.refillValue)
    .slice(0, 15);

  // ── Productos por vencer (compras con vencimiento próximo) ───────
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);
  const expiringMovements = await prisma.inventoryMovement.findMany({
    where: {
      type: 'PURCHASE',
      expirationDate: { gte: new Date(), lte: in30Days },
    },
    include: { product: { select: { name: true, unitOfMeasure: true } } },
    orderBy: { expirationDate: 'asc' },
    take: 20,
  });
  const expiringSoon = expiringMovements.map((m) => ({
    product: m.product.name,
    unit: m.product.unitOfMeasure,
    quantity: Number(m.quantity),
    expirationDate: m.expirationDate!,
    unitCost: m.unitCost ? Number(m.unitCost) : 0,
    value: m.unitCost ? Number(m.quantity) * Number(m.unitCost) : 0,
  }));

  // ── Conteos físicos posteados ────────────────────────────────────
  const postedCounts = await prisma.inventoryPhysicalCount.findMany({
    where: { status: 'POSTED', postedAt: { gte: from, lte: to } },
    include: {
      warehouse: { select: { name: true } },
      items: { select: { varianceQuantity: true, estimatedValueVariance: true } },
    },
    orderBy: { postedAt: 'desc' },
  });
  const postedCountsSummary = {
    total: postedCounts.length,
    items: postedCounts.map((c) => ({
      id: c.id,
      warehouse: c.warehouse.name,
      postedAt: c.postedAt!,
      itemCount: c.items.length,
      totalVarianceQty: c.items.reduce((s, i) => s + Number(i.varianceQuantity ?? 0), 0),
      totalVarianceValue: c.items.reduce((s, i) => s + Number(i.estimatedValueVariance ?? 0), 0),
    })),
  };

  return {
    summary: {
      dispatchCount, theoreticalCost, wasteCost, totalCost,
      averageCostPerDispatch: dispatchCount > 0 ? totalCost / dispatchCount : 0,
      consumptionItemCount,
    },
    movementsByType: {
      PURCHASE: byType['PURCHASE'] ?? emptyMov,
      CONSUMPTION: byType['CONSUMPTION'] ?? emptyMov,
      WASTE: byType['WASTE'] ?? emptyMov,
      TRANSFER: byType['TRANSFER'] ?? emptyMov,
      ADJUSTMENT: byType['ADJUSTMENT'] ?? emptyMov,
    },
    products: Array.from(productsMap.values()).sort((a, b) => b.cost - a.cost),
    recipes: Array.from(recipesMap.values()).sort((a, b) => b.cost - a.cost),
    warehouses,
    wasteByProduct: Array.from(wasteMap.values()).sort((a, b) => b.cost - a.cost),
    menuStructure,
    payrollSummary,
    operatingExpenses,
    criticalStock,
    expiringSoon,
    postedCounts: postedCountsSummary,
  };
}

export async function buildProductionCostsReport({ from, to }: Query) {
  const durationMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);

  const [curr, prev] = await Promise.all([
    computeMetrics(from, to),
    computeMetrics(prevFrom, prevTo),
  ]);

  return {
    period: { from, to },
    previousPeriod: { from: prevFrom, to: prevTo },
    ...curr,
    previousSummary: prev.summary,
  };
}

export type ProductionCostsReport = Awaited<ReturnType<typeof buildProductionCostsReport>>;