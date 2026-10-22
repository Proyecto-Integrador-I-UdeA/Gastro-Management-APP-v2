import type { CashMethod, IncomeStatementCurrencySummary } from '@/types/finance/incomeStatement';

type Props = {
  data: IncomeStatementCurrencySummary;
};

const methodLabels: Record<CashMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro',
};

function money(value: string | number, currency = 'COP') {
  const safe = /^[A-Z]{3}$/.test(currency) ? currency : 'COP';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: safe,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

export default function CashBreakdown({ data }: Props) {
  const { cash } = data.kpis;
  const currency = data.currency;
  const total = Number(cash.totalCollected);

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-xl font-bold text-[#001F3F]">Cobros por medio de pago · {currency}</h2>

      {total === 0 ? (
        <p className="mt-3 text-slate-600">Sin cobros registrados en el período.</p>
      ) : (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(methodLabels) as CashMethod[]).map(method => {
              const amount = Number(cash.byMethod[method] ?? 0);
              const share = total > 0 ? (amount / total) * 100 : 0;
              return (
                <div key={method} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {methodLabels[method]}
                  </p>
                  <p className="mt-1 text-lg font-bold text-[#001F3F]">
                    {money(cash.byMethod[method], currency)}
                  </p>
                  <p className="text-xs text-slate-500">{share.toFixed(1)}% del total</p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            <span className="font-semibold">Cash ratio:</span> {cash.cashRatioPct}%
            {cash.hasClosedSessions && (
              <>
                {' · '}
                <span className="font-semibold">Conciliación de caja:</span>{' '}
                {money(cash.cashReconciliationDifference ?? '0', currency)}
              </>
            )}
          </p>
        </>
      )}
    </section>
  );
}