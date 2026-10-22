import type { IncomeCurrencySummary } from '@/types/finance/income';

type Props = {
  data: IncomeCurrencySummary;
  previous?: IncomeCurrencySummary | null;
};

function money(value: string | number, currency = 'COP') {
  const safe = /^[A-Z]{3}$/.test(currency) ? currency : 'COP';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: safe,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
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

export default function IncomeSummaryCards({ data, previous }: Props) {
  const prev = previous ?? null;

  const cards: Array<[string, string, string, number | null]> = [
    ['Ingreso operativo', money(data.totals.operationalIncome, data.currency), 'from-[#0f274a] to-[#1f4770]',
      prev ? deltaPct(data.totals.operationalIncome, prev.totals.operationalIncome) : null],
    ['Ventas netas', money(data.totals.salesAmount, data.currency), 'from-[#164e63] to-[#0e7490]',
      prev ? deltaPct(data.totals.salesAmount, prev.totals.salesAmount) : null],
    ['Servicio (propinas)', money(data.totals.serviceAmount, data.currency), 'from-[#365314] to-[#4d7c0f]',
      prev ? deltaPct(data.totals.serviceAmount, prev.totals.serviceAmount) : null],
    ['Impuesto al consumo', money(data.totals.consumptionTaxAmount, data.currency), 'from-[#713f12] to-[#a16207]',
      prev ? deltaPct(data.totals.consumptionTaxAmount, prev.totals.consumptionTaxAmount) : null],
    ['Total recaudado', money(data.totals.totalCollected, data.currency), 'from-slate-700 to-slate-600',
      prev ? deltaPct(data.totals.totalCollected, prev.totals.totalCollected) : null],
    ['Ticket promedio', money(data.totals.avgTicket, data.currency), 'from-slate-700 to-slate-600',
      prev ? deltaPct(data.totals.avgTicket, prev.totals.avgTicket) : null],
    ['Pedidos cerrados', String(data.totals.orderCount), 'from-slate-700 to-slate-600',
      prev ? deltaPct(String(data.totals.orderCount), String(prev.totals.orderCount)) : null],
  ];

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[#001F3F]">Resumen</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {data.currency}
        </span>
      </div>
      {prev && (
        <p className="mt-1 text-xs text-slate-500">Δ% vs período anterior</p>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value, gradient, delta]) => (
          <div key={label} className={`rounded-xl bg-gradient-to-br ${gradient} p-4 text-white shadow-sm`}>
            <p className="text-sm text-white/80">{label}</p>
            <p className="mt-1 text-2xl font-bold">
              {value}
              <DeltaBadge delta={delta} />
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}