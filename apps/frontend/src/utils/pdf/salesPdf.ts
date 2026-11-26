import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SalesReportResponse } from '@/lib/reportsApi';
import {
  PDF_COLORS, MARGIN, formatCurrency, formatNumber, formatShortDate,
  drawDocumentHeader, drawMetadataBlock, drawKpiCards, drawSectionTitle,
  drawVerticalBarChart, drawSignatures, drawFooter, buildTableStyles,
  ensureSpace, generateReportId, delta,
} from './pdfTheme';

const PAYMENT_LABEL: Record<string, string> = {
  CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', OTHER: 'Otro',
};
const RESERVATION_LABEL: Record<string, string> = {
  TABLE_RESERVATION: 'Reserva de mesa', PRIVATE_EVENT: 'Evento privado',
  CORPORATE_EVENT: 'Evento corporativo', OTHER: 'Otro',
};

interface Options { preparedBy?: string; logoDataUrl?: string | null }



export function generateSalesPdf(data: SalesReportResponse, opts?: Options) {

  if (!data || !(data as any).period) {
  throw new Error('No se recibieron datos válidos del reporte de ventas');
}


  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const from = new Date(data.period.from);
  const to = new Date(data.period.to);
  const prev = data.previousPeriod;
  const reportId = generateReportId('RPT-VTA');

  let y = drawDocumentHeader(
    doc, 'REPORTE DE VENTAS',
    'Consolidado comercial: pedidos, productos, medios de pago, caja, mesas, SLA de cocina y reservaciones.',
    reportId, { from, to }, opts?.logoDataUrl ?? null,
  );

  y = drawMetadataBlock(doc, y, [
    ['Identificador', reportId],
    ['Período', `${formatShortDate(from)} — ${formatShortDate(to)}`],
    ['Período comparativo', `${formatShortDate(prev.from)} — ${formatShortDate(prev.to)}`],
    ['Fecha de emisión', new Date().toLocaleString('es-CO')],
    ['Área responsable', 'Comercial / Ventas'],
    ['Clasificación', 'Uso interno — Confidencial'],
  ]);

  // ── 01 Resumen ejecutivo ────────────────────────────────────────
  y = drawSectionTitle(doc, y, '01', 'Resumen ejecutivo',
    'Indicadores comerciales clave del período, con variación respecto al período anterior.');

  y = drawKpiCards(doc, y, [
    { label: 'Pedidos cerrados', value: formatNumber(data.summary.orderCount), accent: PDF_COLORS.accent,
      change: delta(data.summary.orderCount, data.previousSummary.orderCount) },
    { label: 'Venta neta', value: formatCurrency(data.summary.totalSales), accent: PDF_COLORS.navyDark,
      change: delta(data.summary.totalSales, data.previousSummary.totalSales) },
    { label: 'Servicio', value: formatCurrency(data.summary.totalService), accent: PDF_COLORS.success,
      change: delta(data.summary.totalService, data.previousSummary.totalService) },
    { label: 'Ítems vendidos', value: formatNumber(data.summary.totalItems), accent: PDF_COLORS.info,
      change: delta(data.summary.totalItems, data.previousSummary.totalItems) },
    { label: 'Ticket promedio', value: formatCurrency(data.summary.avgTicket), accent: PDF_COLORS.accent,
      change: delta(data.summary.avgTicket, data.previousSummary.avgTicket) },
  ]);

  // ── 02 Estado de pedidos ────────────────────────────────────────
  y = ensureSpace(doc, y + 2, 35);
  y = drawSectionTitle(doc, y, '02', 'Estado de pedidos del período',
    'Distribución de pedidos entre cerrados, abiertos y anulados.');
  autoTable(doc, {
    startY: y + 2,
    head: [['Estado', 'Cantidad']],
    body: [
      ['Cerrados (SETTLED)', formatNumber(data.summary.orderCount)],
      ['Abiertos (OPEN)', formatNumber(data.summary.openCount)],
      ['Anulados (VOIDED)', formatNumber(data.summary.voidedCount)],
    ],
    foot: [['TOTAL', formatNumber(data.summary.orderCount + data.summary.openCount + data.summary.voidedCount)]],
    ...buildTableStyles(),
    columnStyles: { 1: { halign: 'right' } },
  });
  // @ts-expect-error lastAutoTable
  y = (doc as any).lastAutoTable.finalY + 6;

    // ── 03 Analíticas del período + YTD ────────────────────────────
  if (data.analytics && data.analytics.summary.closedOrders > 0) {
    y = ensureSpace(doc, y, 55);
    y = drawSectionTitle(doc, y, '03', 'Analíticas del período y acumulado del año',
      'Indicadores clave con comparativo del acumulado anual (YTD).');

    y = drawKpiCards(doc, y, [
      { label: 'Venta neta', value: formatCurrency(data.analytics.summary.salesAmount), accent: PDF_COLORS.navyDark },
      { label: 'Impoconsumo', value: formatCurrency(data.analytics.summary.consumptionTaxAmount), accent: PDF_COLORS.info },
      { label: 'Servicio', value: formatCurrency(data.analytics.summary.serviceAmount), accent: PDF_COLORS.success },
      { label: 'Total cobrado', value: formatCurrency(data.analytics.summary.totalCollected), accent: PDF_COLORS.accent },
      { label: 'Unidades vendidas', value: formatNumber(data.analytics.summary.unitsSold), accent: PDF_COLORS.warning },
    ]);

    autoTable(doc, {
      startY: y + 2,
      head: [['Concepto', 'Período', 'YTD (año)']],
      body: [
        ['Venta neta', formatCurrency(data.analytics.summary.salesAmount), formatCurrency(data.analytics.ytdSummary.salesAmount)],
        ['Impoconsumo', formatCurrency(data.analytics.summary.consumptionTaxAmount), formatCurrency(data.analytics.ytdSummary.consumptionTaxAmount)],
        ['Servicio', formatCurrency(data.analytics.summary.serviceAmount), formatCurrency(data.analytics.ytdSummary.serviceAmount)],
        ['Total cobrado', formatCurrency(data.analytics.summary.totalCollected), formatCurrency(data.analytics.ytdSummary.totalCollected)],
        ['Pedidos cerrados', formatNumber(data.analytics.summary.closedOrders), formatNumber(data.analytics.ytdSummary.closedOrders)],
        ['Unidades vendidas', formatNumber(data.analytics.summary.unitsSold), formatNumber(data.analytics.ytdSummary.unitsSold)],
      ],
      ...buildTableStyles(),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    });
    // @ts-expect-error lastAutoTable
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── 03 Ventas por día ───────────────────────────────────────────
  if (data.salesByDay.length > 0) {
    y = ensureSpace(doc, y, 60);
    y = drawSectionTitle(doc, y, '03', 'Ventas por día',
      'Evolución diaria de ingresos durante el período.');
    y = drawVerticalBarChart(doc, y + 2,
      data.salesByDay.map((d) => ({ label: d.date, value: d.revenue })),
      { barColor: PDF_COLORS.accent, height: 42 });
    y += 4;
  }

  // ── 04 Ventas por producto ──────────────────────────────────────
  if (data.items.length > 0) {
    y = ensureSpace(doc, y, 50);
    y = drawSectionTitle(doc, y, '04', 'Ventas por producto',
      'Cantidad vendida e ingresos consolidados por ítem del menú.');
    const tRev = data.items.reduce((s, it) => s + it.revenue, 0);
    const tQty = data.items.reduce((s, it) => s + it.quantity, 0);
    autoTable(doc, {
      startY: y + 2,
      head: [['#', 'Producto', 'Categoría', 'Cantidad', 'Ingresos']],
      body: data.items.slice(0, 20).map((it, i) => [
        String(i + 1), it.name, it.category,
        formatNumber(it.quantity), formatCurrency(it.revenue),
      ]),
      foot: [['', 'TOTAL', '', formatNumber(tQty), formatCurrency(tRev)]],
      ...buildTableStyles(),
      columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    });
    // @ts-expect-error lastAutoTable
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── 05 Ventas por categoría ─────────────────────────────────────
  if (data.categories.length > 0) {
    y = ensureSpace(doc, y, 45);
    y = drawSectionTitle(doc, y, '05', 'Ventas por categoría',
      'Distribución de ingresos y cantidades según categoría.');
    const tRev = data.categories.reduce((s, c) => s + c.revenue, 0);
    const tQty = data.categories.reduce((s, c) => s + c.quantity, 0);
    autoTable(doc, {
      startY: y + 2,
      head: [['#', 'Categoría', 'Cantidad', 'Ingresos']],
      body: data.categories.map((c, i) => [String(i + 1), c.name, formatNumber(c.quantity), formatCurrency(c.revenue)]),
      foot: [['', 'TOTAL', formatNumber(tQty), formatCurrency(tRev)]],
      ...buildTableStyles(),
      columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    });
    // @ts-expect-error lastAutoTable
    y = (doc as any).lastAutoTable.finalY + 6;
  }

    // ── 07 Rentabilidad por producto ────────────────────────────────
  if (data.profitabilityByProduct && data.profitabilityByProduct.items.length > 0) {
    y = ensureSpace(doc, y, 55);
    y = drawSectionTitle(doc, y, '07', 'Rentabilidad por producto',
      'Margen bruto por producto: ingresos, costo, margen y contribución al margen total.');

    y = drawKpiCards(doc, y, [
      { label: 'Ingresos', value: formatCurrency(data.profitabilityByProduct.totalRevenue), accent: PDF_COLORS.accent },
      { label: 'Costo', value: formatCurrency(data.profitabilityByProduct.totalCost), accent: PDF_COLORS.info, invert: true },
      { label: 'Margen bruto', value: formatCurrency(data.profitabilityByProduct.totalMargin), accent: PDF_COLORS.success },
      { label: '% Margen', value: `${data.profitabilityByProduct.marginPct.toFixed(1)}%`, accent: PDF_COLORS.navyDark },
    ]);

    autoTable(doc, {
      startY: y + 2,
      head: [['#', 'Producto', 'Cat.', 'Cant.', 'Ingresos', 'Costo', 'Margen', '% Marg.', '% Contrib.']],
      body: data.profitabilityByProduct.items.slice(0, 20).map((p, i) => [
        String(i + 1),
        p.name.length > 22 ? p.name.slice(0, 20) + '…' : p.name,
        p.category.length > 12 ? p.category.slice(0, 10) + '…' : p.category,
        formatNumber(p.quantity),
        formatCurrency(p.revenue),
        formatCurrency(p.cost),
        formatCurrency(p.margin),
        `${p.marginPct.toFixed(1)}%`,
        `${p.contributionPct.toFixed(1)}%`,
      ]),
      ...buildTableStyles(),
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' },
        6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' },
      },
    });
    // @ts-expect-error lastAutoTable
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── 06 Medios de pago ───────────────────────────────────────────
  if (data.paymentMethods.length > 0) {
    y = ensureSpace(doc, y, 45);
    y = drawSectionTitle(doc, y, '06', 'Medios de pago',
      'Transacciones registradas y montos recaudados por medio de pago.');
    const tAmt = data.paymentMethods.reduce((s, p) => s + p.amount, 0);
    const tTx = data.paymentMethods.reduce((s, p) => s + p.count, 0);
    autoTable(doc, {
      startY: y + 2,
      head: [['#', 'Medio', 'Transacciones', 'Monto']],
      body: data.paymentMethods.map((p, i) => [
        String(i + 1), PAYMENT_LABEL[p.method] ?? p.method, formatNumber(p.count), formatCurrency(p.amount),
      ]),
      foot: [['', 'TOTAL', formatNumber(tTx), formatCurrency(tAmt)]],
      ...buildTableStyles(),
      columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    });
    // @ts-expect-error lastAutoTable
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── 07 Cuadre de caja ───────────────────────────────────────────
  if (data.cashSessionsSummary.totalClosed > 0) {
    y = ensureSpace(doc, y, 45);
    y = drawSectionTitle(doc, y, '07', 'Cuadre de caja',
      'Sesiones cerradas con comparativo de efectivo esperado vs contado.');
    y = drawKpiCards(doc, y, [
      { label: 'Sesiones cerradas', value: formatNumber(data.cashSessionsSummary.totalClosed), accent: PDF_COLORS.accent },
      { label: 'Con descuadre', value: formatNumber(data.cashSessionsSummary.totalWithDifference), accent: PDF_COLORS.warning, invert: true },
      { label: 'Descuadre total', value: formatCurrency(data.cashSessionsSummary.totalDifference), accent: PDF_COLORS.navyDark, invert: true },
    ]);
    autoTable(doc, {
      startY: y + 2,
      head: [['#', 'Caja', 'Cierre', 'Apertura', 'Esperado', 'Contado', 'Diferencia']],
      body: data.cashSessionsSummary.recent.map((c, i) => [
        String(i + 1), c.register, formatShortDate(c.closedAt),
        formatCurrency(c.openingCash), formatCurrency(c.expectedCash),
        formatCurrency(c.countedCash), formatCurrency(c.difference),
      ]),
      ...buildTableStyles(),
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' },
      },
    });
    // @ts-expect-error lastAutoTable
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── 08 Top mesas ────────────────────────────────────────────────
  if (data.topTables.length > 0) {
    y = ensureSpace(doc, y, 45);
    y = drawSectionTitle(doc, y, '08', 'Mesas de mayor facturación',
      'Las 10 mesas con mayores ingresos en el período.');
    autoTable(doc, {
      startY: y + 2,
      head: [['#', 'Mesa', 'Zona', 'Pedidos', 'Ingresos']],
      body: data.topTables.map((t, i) => [
        String(i + 1), t.code, t.area, formatNumber(t.orders), formatCurrency(t.revenue),
      ]),
      ...buildTableStyles(),
      columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    });
    // @ts-expect-error lastAutoTable
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── 09 SLA de cocina ────────────────────────────────────────────
  if (data.kitchenSLA.totalDispatches > 0) {
    y = ensureSpace(doc, y, 40);
    y = drawSectionTitle(doc, y, '09', 'Tiempos de servicio (SLA de cocina)',
      'Eficiencia operativa en preparación y entrega.');
    y = drawKpiCards(doc, y, [
      { label: 'Despachos', value: formatNumber(data.kitchenSLA.totalDispatches), accent: PDF_COLORS.accent },
      { label: 'Prep. promedio', value: `${data.kitchenSLA.avgPrepMinutes.toFixed(1)} min`, accent: PDF_COLORS.info },
      { label: 'A tiempo', value: formatNumber(data.kitchenSLA.onTimeCount), accent: PDF_COLORS.success },
      { label: 'Fuera de tiempo', value: formatNumber(data.kitchenSLA.delayedCount), accent: PDF_COLORS.danger, invert: true },
      { label: '% Cumplimiento', value: `${data.kitchenSLA.onTimePercent.toFixed(1)}%`, accent: PDF_COLORS.navyDark },
    ]);
  }

  // ── 10 Adiciones vendidas ───────────────────────────────────────
  if (data.addons.length > 0) {
    y = ensureSpace(doc, y, 40);
    y = drawSectionTitle(doc, y, '10', 'Adiciones vendidas',
      'Productos complementarios agregados a pedidos.');
    const tRev = data.addons.reduce((s, a) => s + a.revenue, 0);
    const tQty = data.addons.reduce((s, a) => s + a.quantity, 0);
    autoTable(doc, {
      startY: y + 2,
      head: [['#', 'Adición', 'Cantidad', 'Ingresos']],
      body: data.addons.map((a, i) => [String(i + 1), a.name, formatNumber(a.quantity), formatCurrency(a.revenue)]),
      foot: [['', 'TOTAL', formatNumber(tQty), formatCurrency(tRev)]],
      ...buildTableStyles(),
      columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    });
    // @ts-expect-error lastAutoTable
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── 11 Anulaciones ──────────────────────────────────────────────
  if (data.voidedOrders.length > 0) {
    y = ensureSpace(doc, y, 40);
    y = drawSectionTitle(doc, y, '11', 'Anulaciones del período',
      'Pedidos anulados con su monto estimado y motivo.');
    const tLost = data.voidedOrders.reduce((s, o) => s + o.estimatedAmount, 0);
    autoTable(doc, {
      startY: y + 2,
      head: [['#', 'Mesa', 'Fecha', 'Motivo', 'Monto estimado']],
      body: data.voidedOrders.map((o, i) => [
        String(i + 1), o.tableCode, formatShortDate(o.voidedAt),
        o.reason.length > 40 ? o.reason.slice(0, 38) + '…' : o.reason,
        formatCurrency(o.estimatedAmount),
      ]),
      foot: [['', '', '', 'TOTAL', formatCurrency(tLost)]],
      ...buildTableStyles(),
      columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 4: { halign: 'right' } },
    });
    // @ts-expect-error lastAutoTable
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── 12 Reservaciones ────────────────────────────────────────────
  if (data.reservations.total > 0) {
    y = ensureSpace(doc, y, 50);
    y = drawSectionTitle(doc, y, '12', 'Reservaciones del período',
      'Actividad y estado de las reservaciones agendadas.');
    y = drawKpiCards(doc, y, [
      { label: 'Total reservas', value: formatNumber(data.reservations.total), accent: PDF_COLORS.accent },
      { label: 'Completadas', value: formatNumber(data.reservations.completed), accent: PDF_COLORS.success },
      { label: 'Canceladas', value: formatNumber(data.reservations.cancelled), accent: PDF_COLORS.danger, invert: true },
      { label: '% Cumplimiento', value: `${data.reservations.completionRate.toFixed(1)}%`, accent: PDF_COLORS.navyDark },
    ]);
    if (data.reservations.byType.length > 0) {
      autoTable(doc, {
        startY: y + 2,
        head: [['#', 'Tipo de reserva', 'Cantidad']],
        body: data.reservations.byType.map((r, i) => [
          String(i + 1), RESERVATION_LABEL[r.type] ?? r.type, formatNumber(r.count),
        ]),
        ...buildTableStyles(),
        columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 2: { halign: 'right' } },
      });
      // @ts-expect-error lastAutoTable
      y = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // ── 13 Control documental ───────────────────────────────────────
  y = ensureSpace(doc, y, 55);
  y = drawSectionTitle(doc, y, '13', 'Control documental',
    'Firmas de elaboración, revisión y aprobación del presente reporte.');
  if (opts?.preparedBy) {
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_COLORS.gray700);
    doc.text(`Elaborado por: ${opts.preparedBy}`, MARGIN, y + 2);
    y += 6;
  }
  drawSignatures(doc, y + 2);

  drawFooter(doc, reportId);
  doc.save(`Reporte_Ventas_${data.period.from.slice(0, 10)}_${data.period.to.slice(0, 10)}.pdf`);
}