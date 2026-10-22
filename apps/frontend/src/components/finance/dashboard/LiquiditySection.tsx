import type { FinanceDashboardResponse } from '@/types/finance/financeDashboard';

type Props = {
  data: FinanceDashboardResponse['liquidity'];
  currency: string;
};

function money(value: string | number, currency = 'COP') {
  const safe = /^[A-Z]{3}$/.test(currency) ? currency : 'COP';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: safe,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function coverageColor(value: string | null): string {
  if (value === null) return 'from-slate-500 to-slate-400';
  const n = Number(value);
  if (n >= 1.5) return 'from-emerald-700 to-emerald-600';
  if (n >= 1) return 'from-amber-700 to-amber-600';
  return 'from-red-700 to-red-600';
}

const kindLabels: Record<string, string> = {
  CASH: 'Caja',
  BANK: 'Banco',
  GATEWAY: 'Pasarela',
  OTHER: 'Otro',
};

export default function LiquiditySection({ data, currency }: Props) {
  const coverage = data.coverageRatio;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[#001F3F]">Liquidez</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {currency}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Saldos actuales + cuentas por pagar en los próximos 7 días. Independiente del período consultado.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-gradient-to-br from-[#0f274a] to-[#1f4770] p-4 text-white shadow-sm">
          <p className="text-sm text-white/80">Saldo disponible</p>
          <p className="mt-1 text-2xl font-bold">{money(data.availableBalance, currency)}</p>
          <p className="mt-1 text-xs text-white/70">
            {data.paymentMethods.length} {data.paymentMethods.length === 1 ? 'medio activo' : 'medios activos'}
          </p>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-[#713f12] to-[#a16207] p-4 text-white shadow-sm">
          <p className="text-sm text-white/80">CxP próximos 7 días</p>
          <p className="mt-1 text-2xl font-bold">{money(data.next7DaysPayables, currency)}</p>
          <p className="mt-1 text-xs text-white/70">
            {data.hasPayables
              ? `${data.payablesCount} ${data.payablesCount === 1 ? 'cuenta' : 'cuentas'} por pagar`
              : 'Sin CxP en los próximos 7 días'}
          </p>
        </div>

        <div className={`rounded-xl bg-gradient-to-br ${coverageColor(coverage)} p-4 text-white shadow-sm`}>
          <p className="text-sm text-white/80">Cobertura inmediata</p>
          <p className="mt-1 text-2xl font-bold">
            {coverage === null ? 'N/A' : `${coverage}×`}
          </p>
          <p className="mt-1 text-xs text-white/70">
            {coverage === null
              ? 'Sin CxP para cubrir'
              : Number(coverage) >= 1
                ? `Cubre ${Number(coverage).toFixed(2)}× las CxP de la semana`
                : 'Saldo insuficiente para cubrir las CxP de la semana'}
          </p>
        </div>
      </div>

      {data.paymentMethods.length > 0 && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Saldos por medio
          </h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.paymentMethods.map(m => (
              <div key={m.id} className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {kindLabels[m.kind] ?? m.kind}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#001F3F]">{m.name}</p>
                <p className="mt-1 text-lg font-bold text-emerald-700">
                  {money(m.currentBalance, currency)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}