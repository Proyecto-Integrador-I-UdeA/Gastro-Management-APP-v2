import { Request, Response } from 'express';
import { buildSalesReport } from '../../services/reports/salesReportService';

function parseRange(query: Request['query']) {
  const fromRaw = String(query.from ?? '');
  const toRaw = String(query.to ?? '');
  const from = new Date(fromRaw);
  const to = new Date(toRaw);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) return null;

  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  if (from > to) return null;
  return { from, to };
}

export const salesReportController = {
  async get(req: Request, res: Response) {
    const range = parseRange(req.query);
    if (!range) {
      return res.status(400).json({
        error: 'Rango de fechas inválido. Usa ?from=YYYY-MM-DD&to=YYYY-MM-DD',
      });
    }

    try {
      const report = await buildSalesReport(range);
      return res.json(report);
    } catch (error) {
      console.error('[salesReportController]', error);
      return res
        .status(500)
        .json({ error: 'No se pudo generar el reporte de ventas' });
    }
  },
};