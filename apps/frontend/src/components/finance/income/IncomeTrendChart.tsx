import { AreaChart } from '@tremor/react';
import type { IncomeBucket } from '@/types/finance/income';

type Props = {
  buckets: IncomeBucket[];
  currency: string;
  granularity: 'day' | 'week' | 'month' | 'year';
};

function periodLabel(period: string, granularity: Props['granularity']): string {
  if (granularity === 'year') return period;
  if (granularity === 'month') {
    const [year, month] = period.split('-').map(Number);
    return new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric', timeZone: 'America/Bogota' })
      .format(new Date(Date.UTC(year, month - 1, 15)));
  }
  const [year, month, day] = period.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Bogota' })
    .format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function moneyFormatter(currency: string) {
  const safe = /^[A-Z]{3}$/.test(currency) ? currency : 'COP';
  return (value: number) => new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: safe,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function IncomeTrendChart({ buckets, currency, granularity }: Props) {
  const chartData = buckets.map(bucket => ({
    periodo: periodLabel(bucket.period, granularity),
    Ingresos: Number(bucket.salesAmount),
    Pedidos: bucket.orderCount,
  }));

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-xl font-bold text-[#001F3F]">Tendencia de ingresos · {currency}</h2>
      {chartData.length === 0 ? (
        <p className="mt-3 text-slate-600">No hay datos para graficar.</p>
      ) : (
        <div className="mt-4">
          <AreaChart
            data={chartData}
            index="periodo"
            categories={['Ingresos']}
            colors={['blue']}
            valueFormatter={moneyFormatter(currency)}
            showLegend={false}
            className="h-72"
          />
        </div>
      )}
    </section>
  );
}