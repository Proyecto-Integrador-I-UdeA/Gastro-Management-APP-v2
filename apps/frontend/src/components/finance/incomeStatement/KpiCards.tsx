import type { IncomeStatementCurrencySummary } from '@/types/finance/incomeStatement';

type Props = {
  data: IncomeStatementCurrencySummary;
  previous?: IncomeStatementCurrencySummary | null;
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

function colorByPct(value: string, goodMax: number, warnMax: number): string {
  const n = Number(value ?? 0);
  if (n <= goodMax) return 'from-emerald-700 to-emerald-600';
  if (n <= warnMax) return 'from-amber-700 to-amber-600';
  return 'from-red-700 to-red-600';
}

export default function KpiCards({ data, previous }: Props) {
  const { pnl, kpis } = data;
  const prev = previous ?? null;
  const currency = data.currency;

  type Card = {
    label: string;
    value: string;
    gradient: string;
    sub?: string;
    delta?: number | null;
  };

  const cards: Card[] = [
    {
      label: 'Margen bruto',
      value: pct(kpis.margins.grossMarginPct),
      gradient: 'from-[#164e63] to-[#0e7490]',
      sub: money(pnl.grossProfit, currency),
      delta: prev ? deltaPct(pnl.grossProfit, prev.pnl.grossProfit) : null,
    },
    {
      label: 'Margen operativo',
      value: pct(kpis.margins.operatingMarginPct),
      gradient: Number(kpis.margins.operatingMarginPct) >= 0 ? 'from-[#365314] to-[#4d7c0f]' : 'from-red-700 to-red-600',
      sub: money(pnl.operatingProfit, currency),
    },
    {
      label: 'Food cost %',
      value: pct(kpis.margins.foodCostPct),
      gradient: colorByPct(kpis.margins.foodCostPct, 30, 35),
      sub: money(pnl.cogs.real, currency),
    },
    {
      label: 'Prime cost %',
      value: pct(kpis.margins.primeCostPct),
      gradient: colorByPct(kpis.margins.primeCostPct, 65, 70),
      sub: 'COGS + nómina / ingresos',
    },
    {
      label: 'Labor cost %',
      value: pct(kpis.costStructure.laborCostPct),
      gradient: colorByPct(kpis.costStructure.laborCostPct, 30, 40),
      sub: money(pnl.operatingExpenses.payroll, currency),
    },
    {
      label: 'Merma %',
      value: pct(kpis.margins.wastePct),
      gradient: colorByPct(kpis.margins.wastePct.replace('-', ''), 5, 10),
      sub: money(pnl.cogs.variance, currency),
    },
    {
      label: 'Break-even',
      value: money(kpis.breakEven.revenue, currency),
      gradient: kpis.breakEven.feasible ? 'from-slate-700 to-slate-600' : 'from-slate-400 to-slate-300',
      sub: kpis.breakEven.feasible
        ? `Margen seguridad: ${pct(kpis.breakEven.marginOfSafetyPct)}`
        : 'No viable (margen ≤ 0)',
      delta: prev ? deltaPct(kpis.breakEven.revenue, prev.kpis.breakEven.revenue) : null,
    },
    {
      label: 'Ticket promedio',
      value: money(kpis.volume.avgTicket, currency),
      gradient: 'from-[#0f274a] to-[#1f4770]',
      sub: `${kpis.volume.orderCount} pedidos`,
      delta: prev ? deltaPct(kpis.volume.avgTicket, prev.kpis.volume.avgTicket) : null,
    },
    {
      label: 'Rotación de mesas',
      value: kpis.operations.tableTurnover,
      gradient: 'from-slate-700 to-slate-600',
      sub: 'Pedidos / mesas activas',
    },
  ];

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[#001F3F]">Indicadores principales</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {currency}
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