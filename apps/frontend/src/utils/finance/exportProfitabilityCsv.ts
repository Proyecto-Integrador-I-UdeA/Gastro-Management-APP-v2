import type { ProfitabilitySummaryResponse } from '@/types/finance/profitability';

const SEPARATOR = ';';

function escape(value: unknown): string {
  const text = String(value ?? '');
  if (text.includes(SEPARATOR) || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function row(values: Array<string | number>): string {
  return values.map(escape).join(SEPARATOR);
}

export function downloadProfitabilityCsv(data: ProfitabilitySummaryResponse): void {
  const lines: string[] = [];

  lines.push(row(['Rango', data.period.from, data.period.to]));
  lines.push(row(['Agrupación', data.period.granularity]));
  lines.push('');

  lines.push(row([
    'Divisa',
    'Ingresos',
    'COGS real',
    'COGS teórico',
    'Varianza COGS',
    'Utilidad bruta',
    'Margen bruto %',
    'Gastos operativos',
    'Utilidad operativa',
    'Margen operativo %',
    'Food cost %',
    'Merma %',
  ]));
  for (const c of data.currencies) {
    lines.push(row([
      c.currency,
      c.totals.revenue,
      c.totals.cogsReal,
      c.totals.cogsTheoretical,
      c.totals.cogsVariance,
      c.totals.grossProfit,
      c.totals.grossMarginPct,
      c.totals.operatingExpenses.total,
      c.totals.operatingProfit,
      c.totals.operatingMarginPct,
      c.totals.foodCostPct,
      c.totals.wastePct,
    ]));
  }
  lines.push('');

  for (const c of data.currencies) {
    lines.push(row([`Gastos operativos ${c.currency}`, 'Rubro', 'Monto']));
    lines.push(row([c.currency, 'Costos fijos', c.totals.operatingExpenses.fixedCosts]));
    lines.push(row([c.currency, 'Costos variables', c.totals.operatingExpenses.variableCosts]));
    lines.push(row([c.currency, 'Nómina', c.totals.operatingExpenses.payroll]));
    lines.push(row([c.currency, 'Total', c.totals.operatingExpenses.total]));
    lines.push('');
  }

  for (const c of data.currencies) {
    lines.push(row([`Buckets ${c.currency}`, 'Periodo', 'Ingresos', 'COGS real', 'Utilidad bruta', 'Gastos op.', 'Utilidad op.']));
    for (const b of c.buckets) {
      lines.push(row([
        c.currency,
        b.period,
        b.revenue,
        b.cogsReal,
        b.grossProfit,
        b.operatingExpenses,
        b.operatingProfit,
      ]));
    }
    lines.push('');
  }

  const csv = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rentabilidad_${data.period.from}_${data.period.to}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}