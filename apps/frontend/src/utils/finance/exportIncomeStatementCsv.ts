import type { IncomeStatementSummaryResponse } from '@/types/finance/incomeStatement';

const SEP = ';';

function escape(value: unknown): string {
  const text = String(value ?? '');
  if (text.includes(SEP) || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function row(values: Array<string | number>): string {
  return values.map(escape).join(SEP);
}

export function downloadIncomeStatementCsv(data: IncomeStatementSummaryResponse): void {
  const lines: string[] = [];

  lines.push(row(['Rango', data.period.from, data.period.to]));
  lines.push(row(['Agrupación', data.period.granularity]));
  lines.push('');

  for (const c of data.currencies) {
    const { pnl, kpis } = c;

    lines.push(row([`P&L ${c.currency}`, 'Concepto', 'Monto']));
    lines.push(row([c.currency, 'Ventas netas', pnl.revenue.sales]));
    lines.push(row([c.currency, 'Servicio voluntario', pnl.revenue.service]));
    lines.push(row([c.currency, 'Total ingresos operativos', pnl.revenue.total]));
    lines.push(row([c.currency, 'Impoconsumo (informativo)', pnl.revenue.consumptionTax]));
    lines.push(row([c.currency, 'COGS real', pnl.cogs.real]));
    lines.push(row([c.currency, 'COGS teórico (informativo)', pnl.cogs.theoretical]));
    lines.push(row([c.currency, 'Merma / varianza', pnl.cogs.variance]));
    lines.push(row([c.currency, 'Utilidad bruta', pnl.grossProfit]));
    lines.push(row([c.currency, 'Costos fijos', pnl.operatingExpenses.fixed]));
    lines.push(row([c.currency, 'Costos variables', pnl.operatingExpenses.variable]));
    lines.push(row([c.currency, 'Nómina', pnl.operatingExpenses.payroll]));
    lines.push(row([c.currency, 'Total gastos operativos', pnl.operatingExpenses.total]));
    lines.push(row([c.currency, 'Utilidad operativa', pnl.operatingProfit]));
    lines.push(row([c.currency, 'Utilidad neta', pnl.netProfit]));
    lines.push('');

    lines.push(row([`KPIs ${c.currency}`, 'Grupo', 'Indicador', 'Valor']));
    lines.push(row([c.currency, 'Márgenes', 'Margen bruto %', kpis.margins.grossMarginPct]));
    lines.push(row([c.currency, 'Márgenes', 'Margen operativo %', kpis.margins.operatingMarginPct]));
    lines.push(row([c.currency, 'Márgenes', 'Margen neto %', kpis.margins.netMarginPct]));
    lines.push(row([c.currency, 'Márgenes', 'Food cost %', kpis.margins.foodCostPct]));
    lines.push(row([c.currency, 'Márgenes', 'Prime cost %', kpis.margins.primeCostPct]));
    lines.push(row([c.currency, 'Márgenes', 'Merma %', kpis.margins.wastePct]));
    lines.push(row([c.currency, 'Costos', 'Labor cost %', kpis.costStructure.laborCostPct]));
    lines.push(row([c.currency, 'Costos', 'Rent cost %', kpis.costStructure.rentCostPct]));
    lines.push(row([c.currency, 'Costos', 'Variable cost %', kpis.costStructure.variableCostPct]));
    lines.push(row([c.currency, 'Costos', 'Total cost %', kpis.costStructure.totalCostPct]));
    lines.push(row([c.currency, 'Break-even', 'Revenue', kpis.breakEven.revenue]));
    lines.push(row([c.currency, 'Break-even', 'Pedidos', kpis.breakEven.orders]));
    lines.push(row([c.currency, 'Break-even', 'Margen seguridad %', kpis.breakEven.marginOfSafetyPct]));
    lines.push(row([c.currency, 'Volumen', 'Pedidos', kpis.volume.orderCount]));
    lines.push(row([c.currency, 'Volumen', 'Ticket promedio', kpis.volume.avgTicket]));
    lines.push(row([c.currency, 'Volumen', 'Comensales', kpis.volume.totalGuests]));
    lines.push(row([c.currency, 'Volumen', 'Ingreso por comensal', kpis.volume.revenuePerGuest]));
    lines.push(row([c.currency, 'Volumen', 'Unidades vendidas', kpis.volume.unitsSold]));
    lines.push(row([c.currency, 'Operaciones', 'Rotación mesas', kpis.operations.tableTurnover]));
    lines.push(row([c.currency, 'Operaciones', 'Tiempo cocina (min)', kpis.operations.avgKitchenTimeMinutes ?? 'N/A']));
    lines.push(row([c.currency, 'Operaciones', 'Completación reservas %', kpis.operations.reservationCompletionRatePct ?? 'N/A']));
    lines.push(row([c.currency, 'Caja', 'Total cobrado', kpis.cash.totalCollected]));
    lines.push(row([c.currency, 'Caja', 'Efectivo', kpis.cash.byMethod.CASH]));
    lines.push(row([c.currency, 'Caja', 'Tarjeta', kpis.cash.byMethod.CARD]));
    lines.push(row([c.currency, 'Caja', 'Transferencia', kpis.cash.byMethod.TRANSFER]));
    lines.push(row([c.currency, 'Caja', 'Otro', kpis.cash.byMethod.OTHER]));
    lines.push(row([c.currency, 'Caja', 'Cash ratio %', kpis.cash.cashRatioPct]));
    lines.push(row([c.currency, 'Caja', 'Conciliación', kpis.cash.cashReconciliationDifference ?? 'Sin cierres']));
    lines.push('');

    lines.push(row([`Buckets ${c.currency}`, 'Periodo', 'Ingresos', 'Utilidad bruta', 'Utilidad operativa', 'Utilidad neta']));
    for (const b of c.buckets) {
      lines.push(row([c.currency, b.period, b.revenue, b.grossProfit, b.operatingProfit, b.netProfit]));
    }
    lines.push('');
  }

  const csv = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `estado-resultados_${data.period.from}_${data.period.to}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}