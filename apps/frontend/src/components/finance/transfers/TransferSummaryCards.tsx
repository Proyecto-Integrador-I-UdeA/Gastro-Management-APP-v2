import type { PaymentMethodRef } from '@/types/finance/transfer';

type Props = {
  methods: PaymentMethodRef[];
  loading: boolean;
  error: string;
};

function money(value: string | number, currency = 'COP') {
  const safe = /^[A-Z]{3}$/.test(currency) ? currency : 'COP';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: safe,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

const kindLabels: Record<string, string> = {
  CASH: 'Caja',
  BANK: 'Banco',
  GATEWAY: 'Pasarela',
  OTHER: 'Otro',
};

export default function TransferSummaryCards({ methods, loading, error }: Props) {
  const total = methods.reduce((sum, m) => sum + Number(m.currentBalance), 0);

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[#001F3F]">Saldos por medio</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          Total: {money(total.toFixed(2))}
        </span>
      </div>

      {loading && <p className="mt-3 text-slate-600">Cargando saldos…</p>}
      {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}

      {!loading && !error && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {methods.map(m => (
            <div key={m.id} className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {kindLabels[m.kind] ?? m.kind}
              </p>
              <p className="mt-1 text-lg font-bold text-[#001F3F]">{m.name}</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">
                {money(m.currentBalance, m.currency)}
              </p>
              <p className="text-xs text-slate-500">{m.currency}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}