import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import type {
  CogsRealRow,
  CogsTheoreticalRow,
  OperationalCostRow,
  ProfitabilityDataSource,
  RevenueRow,
} from '../../../src/services/finance/profitabilityService';
import { getProfitabilitySummary } from '../../../src/services/finance/profitabilityService';

function fakeSource(data: {
  revenue?: RevenueRow[];
  cogsTheoretical?: CogsTheoreticalRow[];
  cogsReal?: CogsRealRow[];
  operational?: OperationalCostRow[];
}): ProfitabilityDataSource {
  return {
    loadRevenueRows: async () => data.revenue ?? [],
    loadCogsTheoreticalRows: async () => data.cogsTheoretical ?? [],
    loadCogsRealRows: async () => data.cogsReal ?? [],
    loadOperationalCosts: async () => data.operational ?? [],
  };
}

function rev(orderId: number, ymd: string, amount: number, currency = 'COP'): RevenueRow {
  return {
    orderId,
    settledAt: new Date(`${ymd}T20:00:00.000-05:00`),
    currency,
    revenue: new Prisma.Decimal(amount),
  };
}

function cogsTheo(orderId: number, ymd: string, qty: number, unitCost: number, currency = 'COP'): CogsTheoreticalRow {
  return {
    orderId,
    settledAt: new Date(`${ymd}T20:00:00.000-05:00`),
    currency,
    quantity: qty,
    unitBaseCost: new Prisma.Decimal(unitCost),
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

function opCost(month: string, fixed: number, variable: number, payroll: number): OperationalCostRow {
  return {
    month,
    fixedCosts: new Prisma.Decimal(fixed),
    variableCosts: new Prisma.Decimal(variable),
    payroll: new Prisma.Decimal(payroll),
  };
}

const defaultQuery = {
  from: '2026-01-01',
  to: '2026-01-31',
  granularity: 'month' as const,
};

describe('profitabilityService · revenue + COGS', () => {
  it('calcula gross profit y márgenes con revenue + cogsReal', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-10', 500), rev(2, '2026-01-20', 500)],
      cogsReal: [cogsReal(1, '2026-01-10', 200), cogsReal(2, '2026-01-20', 200)],
      cogsTheoretical: [
        cogsTheo(1, '2026-01-10', 2, 90),
        cogsTheo(2, '2026-01-20', 2, 90),
      ],
    });
    const result = await getProfitabilitySummary(defaultQuery, source);
    const cop = result.currencies[0];

    expect(cop.totals.revenue).toBe('1000.00');
    expect(cop.totals.cogsReal).toBe('400.00');
    expect(cop.totals.cogsTheoretical).toBe('360.00');
    expect(cop.totals.cogsVariance).toBe('40.00');
    expect(cop.totals.grossProfit).toBe('600.00');
    expect(cop.totals.grossMarginPct).toBe('60.00');
    expect(cop.totals.foodCostPct).toBe('40.00');
    expect(cop.totals.wastePct).toBe('11.11');
  });

  it('sin gastos operativos: operatingProfit = grossProfit y hasData = false', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-10', 1000)],
      cogsReal: [cogsReal(1, '2026-01-10', 300)],
    });
    const result = await getProfitabilitySummary(defaultQuery, source);
    const cop = result.currencies[0];

    expect(cop.totals.operatingExpenses.total).toBe('0.00');
    expect(cop.totals.operatingExpenses.hasData).toBe(false);
    expect(cop.totals.operatingProfit).toBe('700.00');
    expect(cop.totals.operatingMarginPct).toBe('70.00');
  });

  it('con gastos operativos completos (mes entero): resta todo', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-15', 2000)],
      cogsReal: [cogsReal(1, '2026-01-15', 600)],
      operational: [opCost('2026-01', 200, 100, 500)],
    });
    const result = await getProfitabilitySummary(defaultQuery, source);
    const cop = result.currencies[0];

    expect(cop.totals.operatingExpenses.fixedCosts).toBe('200.00');
    expect(cop.totals.operatingExpenses.variableCosts).toBe('100.00');
    expect(cop.totals.operatingExpenses.payroll).toBe('500.00');
    expect(cop.totals.operatingExpenses.total).toBe('800.00');
    expect(cop.totals.operatingExpenses.hasData).toBe(true);
    expect(cop.totals.operatingProfit).toBe('600.00'); // 1400 - 800
    expect(cop.totals.operatingMarginPct).toBe('30.00');
  });

  it('con gastos operativos parciales (mitad del mes): prorratea 15/31', async () => {
    // Rango 15-31 de enero = 17 días de 31
    const source = fakeSource({
      revenue: [rev(1, '2026-01-20', 1000)],
      cogsReal: [cogsReal(1, '2026-01-20', 300)],
      operational: [opCost('2026-01', 310, 0, 0)], // 310 * 17/31 = 170.00
    });
    const result = await getProfitabilitySummary(
      { from: '2026-01-15', to: '2026-01-31', granularity: 'month' },
      source,
    );
    const cop = result.currencies[0];

    expect(cop.totals.operatingExpenses.fixedCosts).toBe('170.00');
    expect(cop.totals.operatingProfit).toBe('530.00'); // 700 - 170
  });

  it('rango que cruza dos meses: prorratea cada uno', async () => {
    // Ene 15-31 (17 días) + Feb 1-15 (15 días)
    const source = fakeSource({
      revenue: [rev(1, '2026-01-20', 1000)],
      cogsReal: [cogsReal(1, '2026-01-20', 300)],
      operational: [
        opCost('2026-01', 310, 0, 0), // 310 * 17/31 = 170
        opCost('2026-02', 280, 0, 0), // 280 * 15/28 = 150
      ],
    });
    const result = await getProfitabilitySummary(
      { from: '2026-01-15', to: '2026-02-15', granularity: 'month' },
      source,
    );
    const cop = result.currencies[0];

    expect(cop.totals.operatingExpenses.fixedCosts).toBe('320.00');
  });

  it('mes sin registro en other_costs → ese mes aporta 0, pero hasData=true', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-10', 500), rev(2, '2026-02-10', 500)],
      operational: [opCost('2026-01', 310, 0, 0)], // solo enero tiene registro
    });
    const result = await getProfitabilitySummary(
      { from: '2026-01-01', to: '2026-02-28', granularity: 'month' },
      source,
    );
    const cop = result.currencies[0];
    expect(cop.totals.operatingExpenses.hasData).toBe(true);
    expect(cop.totals.operatingExpenses.fixedCosts).toBe('310.00');
  });

  it('revenue=0 → márgenes en 0.00 sin división por cero', async () => {
    const source = fakeSource({
      cogsReal: [cogsReal(1, '2026-01-10', 100)],
    });
    const result = await getProfitabilitySummary(defaultQuery, source);
    const cop = result.currencies[0];
    expect(cop.totals.revenue).toBe('0.00');
    expect(cop.totals.grossMarginPct).toBe('0.00');
    expect(cop.totals.operatingMarginPct).toBe('0.00');
    expect(cop.totals.foodCostPct).toBe('0.00');
  });

  it('cogsTheoretical=0 → wastePct = 0.00 sin división por cero', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-10', 500)],
      cogsReal: [cogsReal(1, '2026-01-10', 100)],
      // sin cogsTheoretical
    });
    const result = await getProfitabilitySummary(defaultQuery, source);
    expect(result.currencies[0].totals.wastePct).toBe('0.00');
  });

  it('COGS real < teórico → varianza negativa (eficiencia)', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-10', 1000)],
      cogsReal: [cogsReal(1, '2026-01-10', 200)],
      cogsTheoretical: [cogsTheo(1, '2026-01-10', 1, 250)],
    });
    const result = await getProfitabilitySummary(defaultQuery, source);
    expect(result.currencies[0].totals.cogsVariance).toBe('-50.00');
    expect(result.currencies[0].totals.wastePct).toBe('-20.00');
  });
});

describe('profitabilityService · buckets y granularidad', () => {
  it('agrupa por mes: enero y febrero separados', async () => {
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
    const result = await getProfitabilitySummary(
      { from: '2026-01-01', to: '2026-02-28', granularity: 'month' },
      source,
    );
    const buckets = result.currencies[0].buckets;
    expect(buckets.map(b => b.period)).toEqual(['2026-01', '2026-02']);
    expect(buckets[0].revenue).toBe('500.00');
    expect(buckets[1].revenue).toBe('800.00');
  });

  it('agrupa por año: 2025 y 2026 en buckets separados', async () => {
    const source = fakeSource({
      revenue: [
        rev(1, '2025-06-10', 500),
        rev(2, '2026-06-10', 800),
      ],
    });
    const result = await getProfitabilitySummary(
      { from: '2025-01-01', to: '2026-12-31', granularity: 'year' },
      source,
    );
    const buckets = result.currencies[0].buckets;
    expect(buckets.map(b => b.period)).toEqual(['2025', '2026']);
    expect(buckets[0].revenue).toBe('500.00');
    expect(buckets[1].revenue).toBe('800.00');
  });

  it('serie de buckets es continua y rellena con ceros', async () => {
    const source = fakeSource({
      revenue: [rev(1, '2026-01-10', 100), rev(2, '2026-04-10', 200)],
    });
    const result = await getProfitabilitySummary(
      { from: '2026-01-01', to: '2026-04-30', granularity: 'month' },
      source,
    );
    const buckets = result.currencies[0].buckets;
    expect(buckets.map(b => b.period)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(buckets[1].revenue).toBe('0.00');
    expect(buckets[3].revenue).toBe('200.00');
  });
});

describe('profitabilityService · multi-moneda y errores', () => {
  it('multi-moneda: agrupa correctamente y prorratea gastos', async () => {
    const source = fakeSource({
      revenue: [
        rev(1, '2026-01-10', 600, 'COP'),
        rev(2, '2026-01-10', 400, 'COP'),
        rev(3, '2026-01-10', 500, 'USD'),
      ],
      operational: [opCost('2026-01', 1000, 0, 0)],
    });
    const result = await getProfitabilitySummary(defaultQuery, source);
    expect(result.currencies.map(c => c.currency).sort()).toEqual(['COP', 'USD']);
    const cop = result.currencies.find(c => c.currency === 'COP')!;
    const usd = result.currencies.find(c => c.currency === 'USD')!;
    // COP tiene 1000 de 1500 total → 2/3 → 666.67
    expect(Number(cop.totals.operatingExpenses.fixedCosts)).toBeCloseTo(666.67, 2);
    // USD tiene 500 de 1500 → 1/3 → 333.33
    expect(Number(usd.totals.operatingExpenses.fixedCosts)).toBeCloseTo(333.33, 2);
  });

  it('rango sin datos → currencies vacío', async () => {
    const result = await getProfitabilitySummary(
      { from: '2030-01-01', to: '2030-01-31', granularity: 'month' },
      fakeSource({}),
    );
    expect(result.currencies).toEqual([]);
  });

  it('period respeta el query original', async () => {
    const result = await getProfitabilitySummary(
      { from: '2026-01-15', to: '2026-02-15', granularity: 'month' },
      fakeSource({}),
    );
    expect(result.period).toEqual({
      from: '2026-01-15',
      to: '2026-02-15',
      granularity: 'month',
    });
  });
});