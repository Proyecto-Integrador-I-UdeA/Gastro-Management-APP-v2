import type { FinanceDashboardResponse } from '@/types/finance/financeDashboard';

type Props = {
  data: FinanceDashboardResponse['profitability'];
  currency: string;
  hasIncomeData: boolean;
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

function signColor(value: string): string {
  return Number(value) >= 0
    ? 'from-emerald-700 to-emerald-600'
    : 'from-red-700 to-red-600';
}

export default function ProfitabilitySection({ data, currency, hasIncomeData }: Props) {
  if (!hasIncomeData) {
    return (
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-bold text-[#001F3F]">Rentabilidad</h2>
        <p className="mt-3 text-slate-600">No hay ventas en el período seleccionado.</p>
      </section>
    );
  }

  const cards: Array<{ label: string; value: string; sub?: string; gradient: string }> = [
    {
      label: 'Ingresos',
      value: money(data.revenue, currency),
      gradient: 'from-[#0f274a] to-[#1f4770]',
    },
    {
      label: 'Utilidad bruta',
      value: money(data.grossProfit, currency),
      sub: `Margen: ${pct(data.grossMarginPct)}`,
      gradient: signColor(data.grossProfit),
    },
    {
      label: 'Utilidad operativa',
      value: money(data.operatingProfit, currency),
      sub: `Margen: ${pct(data.operatingMarginPct)}`,
      gradient: signColor(data.operatingProfit),
    },
    {
      label: 'Resultado del mes',
      value: money(data.netProfit, currency),
      sub: `Margen: ${pct(data.netMarginPct)}`,
      gradient: signColor(data.netProfit),
    },
    {
      label: 'Margen bruto',
      value: pct(data.grossMarginPct),
      gradient: 'from-[#164e63] to-[#0e7490]',
    },
    {
      label: 'Margen operativo',
      value: pct(data.operatingMarginPct),
      gradient: 'from-[#365314] to-[#4d7c0f]',
    },
  ];

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[#001F3F]">Rentabilidad</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {currency}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ label, value, sub, gradient }) => (
          <div key={label} className={`rounded-xl bg-gradient-to-br ${gradient} p-4 text-white shadow-sm`}>
            <p className="text-sm text-white/80">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            {sub && <p className="mt-1 text-xs text-white/70">{sub}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}