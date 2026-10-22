import type { ProfitabilityByProductResponse } from '@/types/finance/profitabilityByProduct';

type Props = {
  data: ProfitabilityByProductResponse;
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

function foodCostColor(value: string, target: string): string {
  const n = Number(value);
  const t = Number(target);
  if (n <= t - 5) return 'from-emerald-700 to-emerald-600';
  if (n <= t) return 'from-teal-700 to-teal-600';
  if (n <= t + 10) return 'from-amber-700 to-amber-600';
  return 'from-red-700 to-red-600';
}

export default function ExecutiveCards({ data }: Props) {
  const { totals, targets } = data;
  const belowTargetColor = totals.productsBelowTarget === 0
    ? 'from-emerald-700 to-emerald-600'
    : Number(totals.productsBelowTargetPct) <= 20
      ? 'from-amber-700 to-amber-600'
      : 'from-red-700 to-red-600';
  const profitableColor = Number(totals.profitableOrdersPct) >= 90
    ? 'from-emerald-700 to-emerald-600'
    : Number(totals.profitableOrdersPct) >= 70
      ? 'from-amber-700 to-amber-600'
      : 'from-red-700 to-red-600';

  const cards: Array<{ label: string; value: string; gradient: string; sub?: string }> = [
    {
      label: 'Ingresos',
      value: money(totals.revenue, totals.currency),
      gradient: 'from-[#0f274a] to-[#1f4770]',
      sub: `${totals.totalUnitsSold} unidades vendidas`,
    },
    {
      label: 'Utilidad bruta',
      value: money(totals.grossProfit, totals.currency),
      gradient: 'from-[#164e63] to-[#0e7490]',
      sub: `Margen: ${pct(totals.grossMarginPct)} (target ${targets.productMarginTargetPct}%)`,
    },
    {
      label: 'Food cost',
      value: pct(totals.foodCostPct),
      gradient: foodCostColor(totals.foodCostPct, targets.foodCostTargetPct),
      sub: `Target: ${targets.foodCostTargetPct}%`,
    },
    {
      label: '% ventas rentables',
      value: pct(totals.profitableOrdersPct),
      gradient: profitableColor,
      sub: `${totals.profitableOrders} de ${totals.totalOrders} pedidos`,
    },
    {
      label: 'Productos bajo objetivo',
      value: `${totals.productsBelowTarget} / ${totals.totalProducts}`,
      gradient: belowTargetColor,
      sub: `${pct(totals.productsBelowTargetPct)} del total`,
    },
  ];

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[#001F3F]">Lectura ejecutiva</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {totals.currency}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map(({ label, value, gradient, sub }) => (
          <div key={label} className={`rounded-xl bg-gradient-to-br ${gradient} p-4 text-white shadow-sm`}>
            <p className="text-sm text-white/80">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            {sub && <p className="mt-1 text-xs text-white/70">{sub}</p>}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Los umbrales son configurables en <code className="rounded bg-slate-100 px-1 py-0.5">config.finance.food_cost_target_pct</code> y{' '}
        <code className="rounded bg-slate-100 px-1 py-0.5">config.finance.product_margin_target_pct</code>.
      </p>
    </section>
  );
}