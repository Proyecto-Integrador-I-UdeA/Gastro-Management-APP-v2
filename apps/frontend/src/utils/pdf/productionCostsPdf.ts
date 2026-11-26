import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ProductionCostsReportResponse } from '@/lib/reportsApi';
import {
  PDF_COLORS, MARGIN, formatCurrency, formatNumber, formatShortDate,
  drawDocumentHeader, drawMetadataBlock, drawKpiCards, drawSectionTitle,
  drawHorizontalBarChart, drawSignatures, drawFooter, buildTableStyles,
  ensureSpace, generateReportId, delta,
} from './pdfTheme';

interface Options { preparedBy?: string; logoDataUrl?: string | null }



export function generateProductionCostsPdf(data: ProductionCostsReportResponse, opts?: Options) {

  if (!data || !(data as any).period) {
  throw new Error('No se recibieron datos válidos del reporte de producción');
}


  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const from = new Date(data.period.from);
  const to = new Date(data.period.to);
  const prev = data.previousPeriod;
  const reportId = generateReportId('RPT-PROD');

  let y = drawDocumentHeader(
    doc, 'REPORTE DE PRODUCCIÓN Y COSTOS',
    'Análisis integral de costos operativos, consumo de insumos, desperdicio, stock y estructura del menú.',
    reportId, { from, to }, opts?.logoDataUrl ?? null,
  );

  y = drawMetadataBlock(doc, y, [
    ['Identificador', reportId],
    ['Período', `${formatShortDate(from)} — ${formatShortDate(to)}`],
    ['Período comparativo', `${formatShortDate(prev.from)} — ${formatShortDate(prev.to)}`],
    ['Fecha de emisión', new Date().toLocaleString('es-CO')],
    ['Área responsable', 'Producción y Costos'],
    ['Clasificación', 'Uso interno — Confidencial'],
  ]);

  // ── 01 Resumen ejecutivo ────────────────────────────────────────
  y = drawSectionTitle(doc, y, '01', 'Resumen ejecutivo',
    'Indicadores clave de producción y costos, con variación respecto al período anterior.');

  y = drawKpiCards(doc, y, [
    { label: 'Despachos', value: formatNumber(data.summary.dispatchCount), accent: PDF_COLORS.accent,
      change: delta(data.summary.dispatchCount, data.previousSummary.dispatchCount) },
    { label: 'Costo insumos', value: formatCurrency(data.summary.theoreticalCost), accent: PDF_COLORS.info, invert: true,
      change: delta(data.summary.theoreticalCost, data.previousSummary.theoreticalCost) },
    { label: 'Desperdicio', value: formatCurrency(data.summary.wasteCost), accent: PDF_COLORS.warning, invert: true,
      change: delta(data.summary.wasteCost, data.previousSummary.wasteCost) },
    { label: 'Costo total', value: formatCurrency(data.summary.totalCost), accent: PDF_COLORS.navyDark, invert: true,
      change: delta(data.summary.totalCost, data.previousSummary.totalCost) },
    { label: 'Promedio / despacho', value: formatCurrency(data.summary.averageCostPerDispatch), accent: PDF_COLORS.success, invert: true,
      change: delta(data.summary.averageCostPerDispatch, data.previousSummary.averageCostPerDispatch) },
  ]);

  // ── 02 Movimientos reales de inventario ─────────────────────────
  y = ensureSpace(doc, y + 2, 45);
  y = drawSectionTitle(doc, y, '02', 'Movimientos reales de inventario',
    'Valores monetarios efectivos registrados en el período según tipo de movimiento.');

  const movLabels: Array<[keyof typeof data.movementsByType, string]> = [
    ['PURCHASE', 'Compras'], ['CONSUMPTION', 'Consumo'],
    ['WASTE', 'Desperdicio'], ['TRANSFER', 'Transferencias'], ['ADJUSTMENT', 'Ajustes'],
  ];

  autoTable(doc, {
    startY: y + 2,
    head: [['Tipo de movimiento', 'Cantidad', 'Valor total']],
    body: movLabels.map(([k, lbl]) => {
      const m = data.movementsByType[k];
      return [lbl, formatNumber(m.count), formatCurrency(m.totalValue)];
    }),
    ...buildTableStyles(),
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
  });
  // @ts-expect-error lastAutoTable
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── 03 Insumos más consumidos ───────────────────────────────────
  if (data.products.length > 0) {
    y = ensureSpace(doc, y, 50);
    y = drawSectionTitle(doc, y, '03', 'Insumos más consumidos',
      'Cantidades y costos asociados por insumo.');
    const total = data.products.reduce((s, p) => s + p.cost, 0);
    autoTable(doc, {
      startY: y + 2,
      head: [['#', 'Insumo', 'Unidad', 'Cantidad', 'Costo total']],
      body: data.products.slice(0, 15).map((p, i) => [
        String(i + 1), p.name, p.unit,
        formatNumber(Number(p.quantity.toFixed(2)), 2), formatCurrency(p.cost),
      ]),
      foot: [['', 'TOTAL', '', '', formatCurrency(total)]],
      ...buildTableStyles(),
      columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    });
    // @ts-expect-error lastAutoTable
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── 04 Recetas más producidas ───────────────────────────────────
  if (data.recipes.length > 0) {
    y = ensureSpace(doc, y, 50);
    y = drawSectionTitle(doc, y, '04', 'Recetas más producidas',
      'Cantidades producidas y costos según receta ejecutada.');
    const total = data.recipes.reduce((s, r) => s + r.cost, 0);
    autoTable(doc, {
      startY: y + 2,
      head: [['#', 'Receta', 'Cantidad', 'Costo asociado']],
      body: data.recipes.slice(0, 10).map((r, i) => [
        String(i + 1), r.name,
        formatNumber(Number(r.quantity.toFixed(2)), 2), formatCurrency(r.cost),
      ]),
      foot: [['', 'TOTAL', '', formatCurrency(total)]],
      ...buildTableStyles(),
      columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    });
    // @ts-expect-error lastAutoTable
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── 05 Desperdicio real por producto ────────────────────────────
  if (data.wasteByProduct.length > 0) {
    y = ensureSpace(doc, y, 50);
    y = drawSectionTitle(doc, y, '05', 'Desperdicio real por producto',
      'Productos registrados como desperdicio con su valor monetario.');
    const total = data.wasteByProduct.reduce((s, w) => s + w.cost, 0);
    autoTable(doc, {
      startY: y + 2,
      head: [['#', 'Producto', 'Unidad', 'Cantidad', 'Costo del desperdicio']],
      body: data.wasteByProduct.slice(0, 15).map((w, i) => [
        String(i + 1), w.name, w.unit,
        formatNumber(Number(w.quantity.toFixed(2)), 2), formatCurrency(w.cost),
      ]),
      foot: [['', 'TOTAL', '', '', formatCurrency(total)]],
      ...buildTableStyles(),
      columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    });
    // @ts-expect-error lastAutoTable
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── 06 Stock crítico actual ─────────────────────────────────────
  if (data.criticalStock.length > 0) {
    y = ensureSpace(doc, y, 45);
    y = drawSectionTitle(doc, y, '06', 'Stock crítico actual',
      'Productos cuyo stock disponible es inferior al mínimo configurado.');
    const totalRefill = data.criticalStock.reduce((s, c) => s + c.refillValue, 0);
    autoTable(doc, {
      startY: y + 2,
      head: [['#', 'Producto', 'Actual', 'Mínimo', 'Faltante', 'Costo reposición']],
      body: data.criticalStock.map((c, i) => [
        String(i + 1), c.name,
        `${formatNumber(Number(c.currentStock.toFixed(2)), 2)} ${c.unit}`,
        `${formatNumber(Number(c.minStock.toFixed(2)), 2)} ${c.unit}`,
        `${formatNumber(Number(c.missing.toFixed(2)), 2)} ${c.unit}`,
        formatCurrency(c.refillValue),
      ]),
      foot: [['', 'TOTAL', '', '', '', formatCurrency(totalRefill)]],
      ...buildTableStyles(),
      columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 5: { halign: 'right' } },
    });
    // @ts-expect-error lastAutoTable
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── 07 Conteos físicos posteados ────────────────────────────────
  if (data.postedCounts.total > 0) {
    y = ensureSpace(doc, y, 45);
    y = drawSectionTitle(doc, y, '07', 'Conteos físicos posteados',
      'Variaciones entre stock del sistema y conteo físico registrado.');
    autoTable(doc, {
      startY: y + 2,
      head: [['#', 'Almacén', 'Fecha', 'Ítems', 'Variación cant.', 'Variación valor']],
      body: data.postedCounts.items.map((c, i) => [
        String(i + 1), c.warehouse, formatShortDate(c.postedAt),
        formatNumber(c.itemCount),
        formatNumber(Number(c.totalVarianceQty.toFixed(2)), 2),
        formatCurrency(c.totalVarianceValue),
      ]),
      ...buildTableStyles(),
      columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    });
    // @ts-expect-error lastAutoTable
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── 08 Productos por vencer ─────────────────────────────────────
  if (data.expiringSoon.length > 0) {
    y = ensureSpace(doc, y, 45);
    y = drawSectionTitle(doc, y, '08', 'Productos por vencer (próximos 30 días)',
      'Compras registradas con fecha de vencimiento cercana.');
    autoTable(doc, {
      startY: y + 2,
      head: [['#', 'Producto', 'Cantidad', 'Vence', 'Valor']],
      body: data.expiringSoon.map((e, i) => [
        String(i + 1), e.product,
        `${formatNumber(Number(e.quantity.toFixed(2)), 2)} ${e.unit}`,
        formatShortDate(e.expirationDate), formatCurrency(e.value),
      ]),
      ...buildTableStyles(),
      columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    });
    // @ts-expect-error lastAutoTable
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── 09 Estructura de costos del menú ────────────────────────────
  y = ensureSpace(doc, y, 50);
  y = drawSectionTitle(doc, y, '09', 'Estructura de costos del menú',
    'Costos, precios y márgenes promedio del menú activo.');

  y = drawKpiCards(doc, y, [
    { label: 'Ítems activos', value: formatNumber(data.menuStructure.totalActiveItems), accent: PDF_COLORS.accent },
    { label: 'Costo promedio', value: formatCurrency(data.menuStructure.averageCost), accent: PDF_COLORS.info },
    { label: 'Precio promedio', value: formatCurrency(data.menuStructure.averagePrice), accent: PDF_COLORS.navyDark },
    { label: 'Margen promedio', value: `${data.menuStructure.averageMargin.toFixed(1)}%`, accent: PDF_COLORS.success },
  ]);

  if (data.menuStructure.topByCost.length > 0) {
    autoTable(doc, {
      startY: y + 2,
      head: [['#', 'Producto', 'Costo', 'Precio', 'Margen']],
      body: data.menuStructure.topByCost.map((m, i) => [
        String(i + 1), m.name, formatCurrency(m.cost),
        formatCurrency(m.price), `${m.margin.toFixed(1)}%`,
      ]),
      ...buildTableStyles(),
      columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    });
    // @ts-expect-error lastAutoTable
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── 10 Nómina del período ───────────────────────────────────────
  if (data.payrollSummary.entriesCount > 0) {
    y = ensureSpace(doc, y, 40);
    y = drawSectionTitle(doc, y, '10', 'Nómina del período',
      'Costo laboral consolidado del período.');
    autoTable(doc, {
      startY: y + 2,
      head: [['Concepto', 'Valor']],
      body: [
        ['Empleados en nómina', formatNumber(data.payrollSummary.entriesCount)],
        ['Salarios base', formatCurrency(data.payrollSummary.totalSalary)],
        ['Extras y horas', formatCurrency(data.payrollSummary.totalExtras)],
        ['Prestaciones / beneficios', formatCurrency(data.payrollSummary.totalBenefits)],
        ['Deducciones', formatCurrency(data.payrollSummary.totalDeductions)],
      ],
      foot: [['COSTO BRUTO', formatCurrency(data.payrollSummary.grossTotal)]],
      ...buildTableStyles(),
      columnStyles: { 1: { halign: 'right' } },
    });
    // @ts-expect-error lastAutoTable
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── 11 Gastos operativos ────────────────────────────────────────
  if (data.operatingExpenses.items.length > 0) {
    y = ensureSpace(doc, y, 40);
    y = drawSectionTitle(doc, y, '11', 'Gastos operativos',
      'Gastos fijos y variables vigentes del período.');
    autoTable(doc, {
      startY: y + 2,
      head: [['Tipo', 'Concepto', 'Valor']],
      body: data.operatingExpenses.items.map((e) => [
        e.kind === 'FIXED' ? 'Fijo' : 'Variable', e.concept, formatCurrency(e.amount),
      ]),
      foot: [['', 'TOTAL', formatCurrency(data.operatingExpenses.total)]],
      ...buildTableStyles(),
      columnStyles: { 2: { halign: 'right' } },
    });
    // @ts-expect-error lastAutoTable
    y = (doc as any).lastAutoTable.finalY + 6;
  }

    // ── 12 Movimientos financieros del período ──────────────────────
  if (data.financialMovements && data.financialMovements.count > 0) {
    y = ensureSpace(doc, y, 55);
    y = drawSectionTitle(doc, y, '12', 'Movimientos financieros del período',
      'Ingresos y egresos registrados en tesorería, con saldo por medio de pago.');

    y = drawKpiCards(doc, y, [
      { label: 'Ingresos', value: formatCurrency(data.financialMovements.totalIncome), accent: PDF_COLORS.success },
      { label: 'Egresos', value: formatCurrency(data.financialMovements.totalExpense), accent: PDF_COLORS.danger, invert: true },
      { label: 'Neto', value: formatCurrency(data.financialMovements.net), accent: PDF_COLORS.navyDark },
      { label: 'Movimientos', value: formatNumber(data.financialMovements.count), accent: PDF_COLORS.accent },
    ]);

    if (data.financialMovements.byPaymentMethod.length > 0) {
      autoTable(doc, {
        startY: y + 2,
        head: [['#', 'Medio de pago', 'Saldo actual', 'Ingresos', 'Egresos', 'Neto']],
        body: data.financialMovements.byPaymentMethod.map((m, i) => [
          String(i + 1),
          m.name,
          formatCurrency(m.currentBalance),
          formatCurrency(m.income),
          formatCurrency(m.expense),
          formatCurrency(m.net),
        ]),
        ...buildTableStyles(),
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          2: { halign: 'right' }, 3: { halign: 'right' },
          4: { halign: 'right' }, 5: { halign: 'right' },
        },
      });
      // @ts-expect-error lastAutoTable
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    if (data.financialMovements.recent.length > 0) {
      y = ensureSpace(doc, y, 40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...PDF_COLORS.navyDark);
      doc.text('Detalle de movimientos', MARGIN, y);
      y += 4;

      autoTable(doc, {
        startY: y + 2,
        head: [['#', 'Fecha', 'Tipo', 'Concepto', 'Contraparte', 'Medio', 'Monto']],
        body: data.financialMovements.recent.map((m, i) => [
          String(i + 1),
          formatShortDate(m.occurredAt),
          m.kind === 'INCOME' ? 'Ingreso' : 'Egreso',
          m.concept.length > 28 ? m.concept.slice(0, 26) + '…' : m.concept,
          (m.counterpartyName ?? '—').slice(0, 20),
          m.paymentMethodName,
          formatCurrency(m.amount),
        ]),
        ...buildTableStyles(),
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          1: { halign: 'right' },
          6: { halign: 'right' },
        },
      });
      // @ts-expect-error lastAutoTable
      y = (doc as any).lastAutoTable.finalY + 6;
    }
  }

  // ── 12 Distribución por almacén ─────────────────────────────────
  if (data.warehouses.length > 0) {
    y = ensureSpace(doc, y, 45);
    y = drawSectionTitle(doc, y, '12', 'Distribución por almacén',
      'Costo acumulado y despachos atendidos por cada almacén.');
    const tCost = data.warehouses.reduce((s, w) => s + w.cost, 0);
    const tDisp = data.warehouses.reduce((s, w) => s + w.dispatches, 0);
    autoTable(doc, {
      startY: y + 2,
      head: [['#', 'Almacén', 'Despachos', 'Costo acumulado']],
      body: data.warehouses.map((w, i) => [
        String(i + 1), w.name, formatNumber(w.dispatches), formatCurrency(w.cost),
      ]),
      foot: [['', 'TOTAL', formatNumber(tDisp), formatCurrency(tCost)]],
      ...buildTableStyles(),
      columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    });
    // @ts-expect-error lastAutoTable
    y = (doc as any).lastAutoTable.finalY + 8;
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
  doc.save(`Reporte_Produccion_Costos_${data.period.from.slice(0, 10)}_${data.period.to.slice(0, 10)}.pdf`);
}