import type { ProfitabilityCurrencySummary } from '@/types/finance/profitability';

type Props = {
  data: ProfitabilityCurrencySummary;
};

function money(value: string | number, currency = 'COP') {
  const safe = /^[A-Z]{3}$/.test(currency) ? currency : 'COP';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: safe,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

export default function OperatingExpensesBreakdown({ data }: Props) {
  const t = data.totals;
  const e = t.operatingExpenses;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-xl font-bold text-[#001F3F]">
        Gastos operativos · {data.currency}
      </h2>

      {!e.hasData && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          No hay gastos operativos registrados en el período. Cargalos en{' '}
          <a href="/finance/expenses" className="font-semibold underline">Gastos</a>{' '}
          para ver la utilidad neta real.
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b text-slate-600">
              <th className="p-2">Rubro</th>
              <th className="p-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b last:border-0">
              <td className="p-2">Costos fijos</td>
              <td className="p-2 text-right">{money(e.fixedCosts, data.currency)}</td>
            </tr>
            <tr className="border-b last:border-0">
              <td className="p-2">Costos variables</td>
              <td className="p-2 text-right">{money(e.variableCosts, data.currency)}</td>
            </tr>
            <tr className="border-b last:border-0">
              <td className="p-2">Nómina</td>
              <td className="p-2 text-right">{money(e.payroll, data.currency)}</td>
            </tr>
            <tr className="bg-slate-50 font-bold">
              <td className="p-2">Total</td>
              <td className="p-2 text-right">{money(e.total, data.currency)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}