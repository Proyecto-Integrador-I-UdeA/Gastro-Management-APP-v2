import type { IncomeStatementCurrencySummary } from '@/types/finance/incomeStatement';

type Props = {
  data: IncomeStatementCurrencySummary;
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

export default function PnlTable({ data }: Props) {
  const { pnl } = data;
  const currency = data.currency;

  const Row = ({
    label,
    value,
    bold,
    negative,
    indent,
    sub,
    highlight,
  }: {
    label: string;
    value: string;
    bold?: boolean;
    negative?: boolean;
    indent?: boolean;
    sub?: string;
    highlight?: 'positive' | 'negative';
  }) => {
    const valueColor = highlight === 'positive'
      ? 'text-emerald-700'
      : highlight === 'negative'
        ? 'text-red-700'
        : 'text-slate-800';
    return (
      <tr className="border-b border-slate-100 last:border-0">
        <td className={`p-2 ${indent ? 'pl-8 text-slate-600' : 'text-slate-800'} ${bold ? 'font-bold' : ''}`}>
          {label}
          {sub && <span className="block text-xs text-slate-500">{sub}</span>}
        </td>
        <td className={`p-2 text-right ${bold ? 'font-bold' : ''} ${valueColor}`}>
          {value}
        </td>
      </tr>
    );
  };

  const Section = ({ title }: { title: string }) => (
    <tr>
      <td colSpan={2} className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </td>
    </tr>
  );

  const Divider = () => (
    <tr>
      <td colSpan={2} className="py-1">
        <div className="border-t border-slate-300" />
      </td>
    </tr>
  );

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[#001F3F]">Estado de resultados</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {currency}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b text-slate-600">
              <th className="p-2 w-2/3">Concepto</th>
              <th className="p-2 text-right w-1/3">Monto</th>
            </tr>
          </thead>
          <tbody>
            <Section title="Ingresos operativos" />
            <Row label="Ventas netas" value={money(pnl.revenue.sales, currency)} indent />
            <Row label="Servicio voluntario" value={money(pnl.revenue.service, currency)} indent />
            <Divider />
            <Row label="Total ingresos operativos" value={money(pnl.revenue.total, currency)} bold />
            <Row label="Impoconsumo (informativo)" value={money(pnl.revenue.consumptionTax, currency)} indent sub="Pasivo fiscal" />

            <Section title="Costo de ventas (COGS)" />
            <Row label="COGS real" value={money(pnl.cogs.real, currency)} indent />
            <Row label="COGS teórico (informativo)" value={money(pnl.cogs.theoretical, currency)} indent sub="Según recetas" />
            <Row label="Merma / varianza (informativo)" value={money(pnl.cogs.variance, currency)} indent sub="Real - teórico" />

            <Section title="Utilidad bruta" />
            <Row
              label="Utilidad bruta"
              value={money(pnl.grossProfit, currency)}
              bold
              highlight={Number(pnl.grossProfit) >= 0 ? 'positive' : 'negative'}
            />

            <Section title="Gastos operativos" />
            <Row label="Costos fijos" value={money(pnl.operatingExpenses.fixed, currency)} indent />
            <Row label="Costos variables" value={money(pnl.operatingExpenses.variable, currency)} indent />
            <Row label="Nómina" value={money(pnl.operatingExpenses.payroll, currency)} indent />
            <Divider />
            <Row label="Total gastos operativos" value={money(pnl.operatingExpenses.total, currency)} bold />
            {!pnl.operatingExpenses.hasData && (
              <tr>
                <td colSpan={2} className="p-2 text-xs text-amber-700">
                  Sin registro de gastos operativos en el período
                </td>
              </tr>
            )}

            <Section title="Utilidad operativa (EBITDA)" />
            <Row
              label="Utilidad operativa"
              value={money(pnl.operatingProfit, currency)}
              bold
              highlight={Number(pnl.operatingProfit) >= 0 ? 'positive' : 'negative'}
            />

            <Section title="Resultado neto" />
            <Row label="Depreciación / impuestos (no modelado)" value={money(0, currency)} indent />
            <Row
              label="Utilidad neta"
              value={money(pnl.netProfit, currency)}
              bold
              highlight={Number(pnl.netProfit) >= 0 ? 'positive' : 'negative'}
            />
          </tbody>
        </table>
      </div>
    </section>
  );
}