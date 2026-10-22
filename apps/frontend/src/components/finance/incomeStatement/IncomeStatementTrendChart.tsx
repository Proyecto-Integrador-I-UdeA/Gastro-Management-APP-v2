import { AreaChart } from '@tremor/react';
import type { IncomeStatementBucket, IncomeStatementGranularity } from '@/types/finance/incomeStatement';

type Props = {
  buckets: IncomeStatementBucket[];
  currency: string;
  granularity: IncomeStatementGranularity;
};

function periodLabel(period: string, granularity: IncomeStatementGranularity): string {
  if (granularity === 'year') return period;
  const [year, month] = period.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', {
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(new Date(Date.UTC(year, month - 1, 15)));
}

function moneyFormatter(currency: string) {
  const safe = /^[A-Z]{3}$/.test(currency) ? currency : 'COP';
  return (value: number) => new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: safe,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function IncomeStatementTrendChart({ buckets, currency, granularity }: Props) {
  const chartData = buckets.map(bucket => ({
    periodo: periodLabel(bucket.period, granularity),
    Ingresos: Number(bucket.revenue),
    'Utilidad bruta': Number(bucket.grossProfit),
    'Utilidad operativa': Number(bucket.operatingProfit),
    'Utilidad neta': Number(bucket.netProfit),
  }));

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-xl font-bold text-[#001F3F]">Tendencia · {currency}</h2>
      {chartData.length === 0 ? (
        <p className="mt-3 text-slate-600">No hay datos para graficar.</p>
      ) : (
        <div className="mt-4">
          <AreaChart
            data={chartData}
            index="periodo"
            categories={['Ingresos', 'Utilidad bruta', 'Utilidad operativa', 'Utilidad neta']}
            colors={['blue', 'cyan', 'emerald', 'violet']}
            valueFormatter={moneyFormatter(currency)}
            className="h-80"
          />
        </div>
      )}
    </section>
  );
}