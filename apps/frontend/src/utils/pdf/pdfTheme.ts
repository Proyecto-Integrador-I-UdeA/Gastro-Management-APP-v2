import jsPDF from 'jspdf';

export const PDF_COLORS = {
  navyDark: [10, 37, 64] as [number, number, number],
  navy: [15, 23, 42] as [number, number, number],
  accent: [30, 64, 175] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  gray50: [248, 250, 252] as [number, number, number],
  gray100: [241, 245, 249] as [number, number, number],
  gray200: [226, 232, 240] as [number, number, number],
  gray300: [203, 213, 225] as [number, number, number],
  gray500: [100, 116, 139] as [number, number, number],
  gray700: [51, 65, 85] as [number, number, number],
  gray900: [15, 23, 42] as [number, number, number],
  success: [5, 150, 105] as [number, number, number],
  warning: [217, 119, 6] as [number, number, number],
  danger: [220, 38, 38] as [number, number, number],
  info: [2, 132, 199] as [number, number, number],
};

export const PAGE_WIDTH = 210;
export const PAGE_HEIGHT = 297;
export const MARGIN = 18;
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export const COMPANY = {
  name: 'GASTRO MANAGEMENT',
  legalName: 'Gastro Management S.A.S.',
  nit: 'NIT 900.000.000-0',
  address: 'Medellín, Colombia',
  email: 'contacto@gastromanagement.app',
  website: 'www.gastromanagement.app',
};

export const formatCurrency = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

export const formatNumber = (v: number, d = 0) =>
  new Intl.NumberFormat('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

export const formatShortDate = (d: Date | string) =>
  new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d));

export const formatLongDate = (d: Date | string) =>
  new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(d));

export function generateReportId(prefix: string): string {
  const n = new Date();
  const p = (v: number) => String(v).padStart(2, '0');
  return `${prefix}-${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}-${p(n.getHours())}${p(n.getMinutes())}`;
}

export function delta(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / prev) * 100;
}

export async function loadLogoAsDataUrl(url = '/images/logotipo.jpg'): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : null);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

export function drawDocumentHeader(
  doc: jsPDF, title: string, subtitle: string, reportId: string,
  period: { from: Date; to: Date }, logoDataUrl?: string | null,
): number {
  doc.setFillColor(...PDF_COLORS.navyDark);
  doc.rect(0, 0, PAGE_WIDTH, 40, 'F');
  doc.setFillColor(...PDF_COLORS.accent);
  doc.rect(0, 40, PAGE_WIDTH, 1.2, 'F');

  const headerLeft = logoDataUrl ? MARGIN + 18 : MARGIN;
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, 'JPEG', MARGIN, 8, 14, 14); } catch { /* silencioso */ }
  }

  doc.setTextColor(...PDF_COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(COMPANY.name, headerLeft, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Documento N° ${reportId}`, PAGE_WIDTH - MARGIN, 11, { align: 'right' });

  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text(title, headerLeft, 24);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const sub = doc.splitTextToSize(subtitle, CONTENT_WIDTH - 80 - (logoDataUrl ? 18 : 0));
  doc.text(sub, headerLeft, 31);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('PERÍODO ANALIZADO', PAGE_WIDTH - MARGIN, 24, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`${formatShortDate(period.from)} — ${formatShortDate(period.to)}`, PAGE_WIDTH - MARGIN, 30, { align: 'right' });

  return 50;
}

export function drawMetadataBlock(doc: jsPDF, y: number, items: Array<[string, string]>): number {
  const rows = Math.ceil(items.length / 2);
  const blockHeight = rows * 9 + 5;
  const colWidth = (CONTENT_WIDTH - 6) / 2;

  doc.setFillColor(...PDF_COLORS.gray50);
  doc.setDrawColor(...PDF_COLORS.gray200);
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, blockHeight, 1.5, 1.5, 'FD');

  items.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + 6 + col * (colWidth + 2);
    const yl = y + 6 + row * 9;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_COLORS.gray500);
    doc.text(label.toUpperCase(), x, yl);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_COLORS.gray900);
    doc.text(value, x, yl + 4.5);
  });

  return y + blockHeight + 7;
}

export interface KpiItem {
  label: string;
  value: string;
  accent?: [number, number, number];
  hint?: string;
  change?: number | null;
  invert?: boolean;
}

export function drawKpiCards(doc: jsPDF, y: number, kpis: KpiItem[]): number {
  const gap = 3;
  const w = (CONTENT_WIDTH - gap * (kpis.length - 1)) / kpis.length;
  const h = 24;

  kpis.forEach((kpi, i) => {
    const x = MARGIN + i * (w + gap);
    const accent = kpi.accent ?? PDF_COLORS.accent;

    doc.setFillColor(...PDF_COLORS.white);
    doc.setDrawColor(...PDF_COLORS.gray200);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, w, h, 1.5, 1.5, 'FD');

    doc.setFillColor(...accent);
    doc.rect(x, y, 1.8, h, 'F');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_COLORS.gray500);
    doc.text(kpi.label.toUpperCase(), x + 5, y + 6);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_COLORS.gray900);
    doc.text(kpi.value, x + 5, y + 15);

    if (kpi.change !== undefined) {
      if (kpi.change === null) {
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...PDF_COLORS.gray500);
        doc.text('— sin comparación', x + 5, y + 20);
      } else {
        const good = kpi.invert ? kpi.change <= 0 : kpi.change >= 0;
        const color = kpi.change === 0 ? PDF_COLORS.gray500 : good ? PDF_COLORS.success : PDF_COLORS.danger;
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...color);
        const arrow = kpi.change === 0 ? '•' : kpi.change > 0 ? '▲' : '▼';
        const sign = kpi.change > 0 ? '+' : '';
        doc.text(`${arrow} ${sign}${kpi.change.toFixed(1)}%`, x + 5, y + 20);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(...PDF_COLORS.gray500);
        doc.text('vs. período anterior', x + 5, y + 22.5);
      }
    } else if (kpi.hint) {
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...PDF_COLORS.gray500);
      doc.text(kpi.hint, x + 5, y + 20);
    }
  });

  return y + h + 6;
}

export function drawSectionTitle(
  doc: jsPDF, y: number, number: string, title: string, description?: string,
): number {
  doc.setFillColor(...PDF_COLORS.accent);
  doc.roundedRect(MARGIN, y, 8, 8, 1.5, 1.5, 'F');
  doc.setTextColor(...PDF_COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(number, MARGIN + 4, y + 5.3, { align: 'center' });

  doc.setTextColor(...PDF_COLORS.navyDark);
  doc.setFontSize(11);
  doc.text(title, MARGIN + 11, y + 5.5);

  let next = y + 10;
  if (description) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_COLORS.gray500);
    const lines = doc.splitTextToSize(description, CONTENT_WIDTH);
    doc.text(lines, MARGIN, next + 2);
    next += lines.length * 3.5 + 3;
  }
  return next;
}

export function drawHorizontalBarChart(
  doc: jsPDF, y: number,
  items: Array<{ label: string; value: number; valueLabel?: string }>,
  options?: { barColor?: [number, number, number] },
): number {
  const barColor = options?.barColor ?? PDF_COLORS.accent;
  const rowHeight = 6.2;
  const labelWidth = 48;
  const valueWidth = 26;
  const chartX = MARGIN + labelWidth;
  const chartWidth = CONTENT_WIDTH - labelWidth - valueWidth - 4;
  const maxValue = Math.max(...items.map((i) => i.value), 1);

  items.forEach((item, i) => {
    const rowY = y + i * rowHeight;
    const barWidth = (item.value / maxValue) * chartWidth;

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_COLORS.gray700);
    const label = item.label.length > 32 ? item.label.slice(0, 30) + '…' : item.label;
    doc.text(label, MARGIN, rowY + 4);

    doc.setFillColor(...PDF_COLORS.gray100);
    doc.roundedRect(chartX, rowY + 1, chartWidth, 4, 1, 1, 'F');
    doc.setFillColor(...barColor);
    doc.roundedRect(chartX, rowY + 1, Math.max(barWidth, 1.2), 4, 1, 1, 'F');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_COLORS.gray900);
    doc.text(item.valueLabel ?? formatNumber(item.value), PAGE_WIDTH - MARGIN, rowY + 4.3, { align: 'right' });
  });

  return y + items.length * rowHeight + 3;
}

export function drawVerticalBarChart(
  doc: jsPDF, y: number,
  items: Array<{ label: string; value: number }>,
  options?: { barColor?: [number, number, number]; height?: number; maxBars?: number },
): number {
  const height = options?.height ?? 42;
  const barColor = options?.barColor ?? PDF_COLORS.accent;
  const maxBars = options?.maxBars ?? 60;
  const shown = items.length > maxBars ? items.slice(-maxBars) : items;
  if (shown.length === 0) return y;

  const chartWidth = CONTENT_WIDTH;
  const gap = 1;
  const barWidth = (chartWidth - gap * (shown.length - 1)) / shown.length;
  const maxValue = Math.max(...shown.map((i) => i.value), 1);
  const baseline = y + height;

  doc.setDrawColor(...PDF_COLORS.gray300);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, baseline, MARGIN + chartWidth, baseline);

  shown.forEach((item, i) => {
    const barH = (item.value / maxValue) * (height - 4);
    const x = MARGIN + i * (barWidth + gap);
    doc.setFillColor(...barColor);
    doc.rect(x, baseline - barH, barWidth, barH, 'F');
  });

  const every = Math.max(1, Math.ceil(shown.length / 8));
  shown.forEach((item, i) => {
    if (i % every !== 0 && i !== shown.length - 1) return;
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_COLORS.gray500);
    doc.text(item.label.slice(-5), MARGIN + i * (barWidth + gap) + barWidth / 2, baseline + 4, { align: 'center' });
  });

  return baseline + 8;
}

export function drawSignatures(doc: jsPDF, y: number): number {
  const roles = ['Elaborado por', 'Revisado por', 'Aprobado por'];
  const gap = 6;
  const w = (CONTENT_WIDTH - gap * 2) / 3;
  const h = 24;

  roles.forEach((role, i) => {
    const x = MARGIN + i * (w + gap);
    doc.setDrawColor(...PDF_COLORS.gray300);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, y, w, h, 1, 1, 'S');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_COLORS.gray500);
    doc.text(role.toUpperCase(), x + 4, y + 5);

    doc.setDrawColor(...PDF_COLORS.gray500);
    doc.line(x + 4, y + 15, x + w - 4, y + 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Nombre y firma', x + 4, y + 19);
  });

  return y + h + 4;
}

export function drawFooter(doc: jsPDF, reportId: string): void {
  const total = doc.getNumberOfPages();
  const y = PAGE_HEIGHT - 15;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...PDF_COLORS.gray200);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_COLORS.gray500);
    doc.text(`${COMPANY.legalName}  ·  ${COMPANY.nit}  ·  Documento confidencial de uso interno`, MARGIN, y + 4);
    doc.text(`${reportId}  ·  Emitido ${new Date().toLocaleString('es-CO')}`, MARGIN, y + 7.5);

    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${i} de ${total}`, PAGE_WIDTH - MARGIN, y + 4, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(COMPANY.website, PAGE_WIDTH - MARGIN, y + 7.5, { align: 'right' });
  }
}

export function buildTableStyles() {
  return {
    styles: {
      font: 'helvetica', fontSize: 8,
      cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
      textColor: PDF_COLORS.gray900,
      lineColor: PDF_COLORS.gray200,
      lineWidth: 0.1,
    },
    headStyles: { fillColor: PDF_COLORS.navyDark, textColor: PDF_COLORS.white, fontStyle: 'bold' as const, fontSize: 8 },
    footStyles: { fillColor: PDF_COLORS.gray100, textColor: PDF_COLORS.gray900, fontStyle: 'bold' as const, fontSize: 8 },
    alternateRowStyles: { fillColor: PDF_COLORS.gray50 },
    margin: { left: MARGIN, right: MARGIN },
  };
}

export function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_HEIGHT - 25) { doc.addPage(); return MARGIN + 6; }
  return y;
}