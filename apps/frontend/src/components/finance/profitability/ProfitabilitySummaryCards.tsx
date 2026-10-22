import type { ProfitabilityCurrencySummary } from '@/types/finance/profitability';

type Props = {
  data: ProfitabilityCurrencySummary;
  previous?: ProfitabilityCurrencySummary | null;
};

function money(value: string | number, currency = 'COP') {
  const safe = /^[A-Z]{3}$/.test(currency) ? currency : 'COP';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: safe,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function pct(value: string) {
  return `${Number(value ?? 0).toFixed(2)}%`;
}

function deltaPct(current: string, previous: string): number | null {
  const c = Number(current);
  const p = Number(previous);
  if (p === 0) return null;
  return ((c - p) / p) * 100;
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const isUp = delta >= 0;
  const sign = isUp ? '+' : '';
  const cls = isUp ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800';
  return (
    <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}>
      {sign}{delta.toFixed(1)}%
    </span>
  );
}

function foodCostColor(value: number): string {
  if (value <= 30) return 'from-emerald-700 to-emerald-600';
  if (value <= 35) return 'from-amber-700 to-amber-600';
  return 'from-red-700 to-red-600';
}

function wasteColor(value: number): string {
  if (Math.abs(value) <= 5) return 'from-emerald-700 to-emerald-600';
  if (Math.abs(value) <= 10) return 'from-amber-700 to-amber-600';
  return 'from-red-700 to-red-600';
}

export default function ProfitabilitySummaryCards({ data, previous }: Props) {
  const t = data.totals;
  const prev = previous ?? null;
  const foodCostNum = Number(t.foodCostPct);
  const wasteNum = Number(t.wastePct);
  const opProfitPositive = Number(t.operatingProfit) >= 0;

  const cards: Array<{
    label: string;
    value: string;
    gradient: string;
    sub?: string;
    delta?: number | null;
  }> = [
    {
      label: 'Ingresos',
      value: money(t.revenue, data.currency),
      gradient: 'from-[#0f274a] to-[#1f4770]',
      delta: prev ? deltaPct(t.revenue, prev.totals.revenue) : null,
    },
    {
      label: 'COGS real',
      value: money(t.cogsReal, data.currency),
      gradient: 'from-[#7c2d12] to-[#c2410c]',
      sub: `Teórico: ${money(t.cogsTheoretical, data.currency)}`,
      delta: prev ? deltaPct(t.cogsReal, prev.totals.cogsReal) : null,
    },
    {
      label: 'Utilidad bruta',
      value: money(t.grossProfit, data.currency),
      gradient: 'from-[#164e63] to-[#0e7490]',
      sub: `Margen: ${pct(t.grossMarginPct)}`,
      delta: prev ? deltaPct(t.grossProfit, prev.totals.grossProfit) : null,
    },
    {
      label: 'Gastos operativos',
      value: money(t.operatingExpenses.total, data.currency),
      gradient: 'from-slate-700 to-slate-600',
      sub: t.operatingExpenses.hasData ? undefined : 'Sin registro en el período',
      delta: prev ? deltaPct(t.operatingExpenses.total, prev.totals.operatingExpenses.total) : null,
    },
    {
      label: 'Utilidad operativa',
      value: money(t.operatingProfit, data.currency),
      gradient: opProfitPositive ? 'from-[#365314] to-[#4d7c0f]' : 'from-red-700 to-red-600',
      sub: `Margen: ${pct(t.operatingMarginPct)}`,
      delta: prev ? deltaPct(t.operatingProfit, prev.totals.operatingProfit) : null,
    },
    {
      label: 'Food cost',
      value: pct(t.foodCostPct),
      gradient: foodCostColor(foodCostNum),
      delta: prev ? deltaPct(t.foodCostPct, prev.totals.foodCostPct) : null,
    },
    {
      label: 'Merma (varianza COGS)',
      value: pct(t.wastePct),
      gradient: wasteColor(wasteNum),
      sub: `${money(t.cogsVariance, data.currency)} vs teórico`,
      delta: prev ? deltaPct(t.wastePct, prev.totals.wastePct) : null,
    },
  ];

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[#001F3F]">Resumen de rentabilidad</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {data.currency}
        </span>
      </div>
      {prev && (
        <p className="mt-1 text-xs text-slate-500">Δ% vs período anterior</p>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ label, value, gradient, sub, delta }) => (
          <div key={label} className={`rounded-xl bg-gradient-to-br ${gradient} p-4 text-white shadow-sm`}>
            <p className="text-sm text-white/80">{label}</p>
            <p className="mt-1 text-2xl font-bold">
              {value}
              <DeltaBadge delta={delta ?? null} />
            </p>
            {sub && <p className="mt-1 text-xs text-white/70">{sub}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}