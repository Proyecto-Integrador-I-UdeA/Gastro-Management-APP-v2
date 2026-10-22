import type { ManualMovementSummary, PosSalesOfDay } from '@/types/finance/manualMovement';

type Props = {
  data: ManualMovementSummary;
  posSales: PosSalesOfDay | null;
};

function money(value: string | number, currency = 'COP') {
  const safe = /^[A-Z]{3}$/.test(currency) ? currency : 'COP';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: safe,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

export default function MovementSummaryCards({ data, posSales }: Props) {
  const pos = posSales?.cashSalesAmount ?? '0.00';
  const manualIncome = data.day.income;
  const totalIncome = (Number(pos) + Number(manualIncome)).toFixed(2);
  const expenses = data.day.expense;
  const net = (Number(totalIncome) - Number(expenses)).toFixed(2);

  const cards: Array<{ label: string; value: string; gradient: string; sub?: string }> = [
    {
      label: 'Ingresos del día',
      value: money(totalIncome),
      gradient: 'from-[#164e63] to-[#0e7490]',
      sub: `POS: ${money(pos)} · Manuales: ${money(manualIncome)}`,
    },
    {
      label: 'Egresos del día',
      value: money(expenses),
      gradient: 'from-[#7c2d12] to-[#c2410c]',
      sub: 'Solo manuales (POS no genera egresos)',
    },
    {
      label: 'Neto del día',
      value: money(net),
      gradient: Number(net) >= 0 ? 'from-[#365314] to-[#4d7c0f]' : 'from-red-700 to-red-600',
      sub: 'Ingresos − egresos',
    },
    {
      label: 'Pendientes del día',
      value: String(data.day.pendingCount),
      gradient: 'from-slate-700 to-slate-600',
      sub: data.day.pendingCount === 0 ? 'Sin pendientes' : 'Requieren conciliación',
    },
    {
      label: 'Ingresos del mes',
      value: money(data.month.income),
      gradient: 'from-slate-700 to-slate-600',
      sub: `${data.month.from} → ${data.month.to}`,
    },
    {
      label: 'Egresos del mes',
      value: money(data.month.expense),
      gradient: 'from-slate-700 to-slate-600',
    },
    {
      label: 'Neto del mes (manual)',
      value: money(data.month.net),
      gradient: Number(data.month.net) >= 0 ? 'from-emerald-700 to-emerald-600' : 'from-red-700 to-red-600',
    },
  ];

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[#001F3F]">Resumen</h2>
        <span className="text-xs text-slate-500">{data.date}</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map(({ label, value, gradient, sub }) => (
          <div key={label} className={`rounded-xl bg-gradient-to-br ${gradient} p-4 text-white shadow-sm`}>
            <p className="text-sm text-white/80">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            {sub && <p className="mt-1 text-xs text-white/70">{sub}</p>}
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-slate-200 pt-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Saldos por medio de pago
        </h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.byPaymentMethod.map(m => (
            <div key={m.id} className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {m.name} · {m.kind}
              </p>
              <p className="mt-1 text-lg font-bold text-[#001F3F]">
                Saldo: {money(m.currentBalance, m.currency)}
              </p>
              <p className="text-xs text-slate-500">
                Día: +{money(m.dayIncome, m.currency)} / −{money(m.dayExpense, m.currency)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}