import type { IncomeSummaryResponse } from '@/types/finance/income';

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

export function downloadIncomeCsv(data: IncomeSummaryResponse): void {
  const lines: string[] = [];

  lines.push(row(['Rango', data.period.from, data.period.to]));
  lines.push(row(['Reconocimiento', data.period.recognition]));
  lines.push(row(['Agrupación', data.period.granularity]));
  lines.push(row(['Incluye servicio', data.period.includeService ? 'Sí' : 'No']));
  lines.push('');

  lines.push(row(['Divisa', 'Ventas netas', 'Impoconsumo', 'Servicio', 'Total recaudado', 'Ingreso operativo', 'Ticket promedio', 'Pedidos']));
  for (const c of data.currencies) {
    lines.push(row([
      c.currency,
      c.totals.salesAmount,
      c.totals.consumptionTaxAmount,
      c.totals.serviceAmount,
      c.totals.totalCollected,
      c.totals.operationalIncome,
      c.totals.avgTicket,
      c.totals.orderCount,
    ]));
  }
  lines.push('');

  for (const c of data.currencies) {
    lines.push(row([`Buckets ${c.currency}`, 'Periodo', 'Ventas netas', 'Pedidos']));
    for (const b of c.buckets) {
      lines.push(row([c.currency, b.period, b.salesAmount, b.orderCount]));
    }
    if (c.byPaymentMethod) {
      lines.push(row([`Métodos ${c.currency}`, 'CASH', 'CARD', 'TRANSFER', 'OTHER']));
      lines.push(row([
        c.currency,
        c.byPaymentMethod.CASH,
        c.byPaymentMethod.CARD,
        c.byPaymentMethod.TRANSFER,
        c.byPaymentMethod.OTHER,
      ]));
    }
    lines.push('');
  }

  // BOM UTF-8 para que Excel detecte la codificación
  const csv = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ingresos_${data.period.from}_${data.period.to}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}