import type { FinanceDashboardResponse } from '@/types/finance/financeDashboard';

type Props = {
  data: FinanceDashboardResponse['efficiency'];
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

function foodCostColor(value: string): string {
  const n = Number(value);
  if (n <= 30) return 'from-emerald-700 to-emerald-600';
  if (n <= 35) return 'from-amber-700 to-amber-600';
  return 'from-red-700 to-red-600';
}

function fixedCostColor(value: string): string {
  const n = Number(value);
  if (n <= 20) return 'from-emerald-700 to-emerald-600';
  if (n <= 30) return 'from-amber-700 to-amber-600';
  return 'from-red-700 to-red-600';
}

export default function EfficiencySection({ data, currency, hasIncomeData }: Props) {
  if (!hasIncomeData) {
    return (
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-bold text-[#001F3F]">Eficiencia</h2>
        <p className="mt-3 text-slate-600">No hay ventas en el período seleccionado.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[#001F3F]">Eficiencia</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {currency}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-gradient-to-br from-[#0f274a] to-[#1f4770] p-4 text-white shadow-sm">
          <p className="text-sm text-white/80">Ticket promedio</p>
          <p className="mt-1 text-2xl font-bold">{money(data.avgTicket, currency)}</p>
          <p className="mt-1 text-xs text-white/70">Ingresos ÷ pedidos cerrados</p>
        </div>

        <div className={`rounded-xl bg-gradient-to-br ${foodCostColor(data.foodCostPct)} p-4 text-white shadow-sm`}>
          <p className="text-sm text-white/80">Food cost</p>
          <p className="mt-1 text-2xl font-bold">{pct(data.foodCostPct)}</p>
          <p className="mt-1 text-xs text-white/70">COGS real ÷ ingresos</p>
        </div>

        <div className={`rounded-xl bg-gradient-to-br ${fixedCostColor(data.fixedCostRatioPct)} p-4 text-white shadow-sm`}>
          <p className="text-sm text-white/80">Gasto fijo / ventas</p>
          <p className="mt-1 text-2xl font-bold">{pct(data.fixedCostRatioPct)}</p>
          <p className="mt-1 text-xs text-white/70">Costos fijos ÷ ingresos</p>
        </div>
      </div>
    </section>
  );
}