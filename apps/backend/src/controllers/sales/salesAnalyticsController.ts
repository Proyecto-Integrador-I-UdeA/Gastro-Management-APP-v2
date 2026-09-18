import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../middlewares/auth';
import { salesAnalyticsQuerySchema } from '../../schemas/salesAnalyticsSchema';
import { getSalesAnalytics } from '../../services/sales/salesAnalyticsService';
import { SalesOperationError } from '../../services/sales/salesOrderService';

export async function getAnalytics(req: AuthenticatedRequest, res: Response) {
  const parsed = salesAnalyticsQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Solicitud de analítica inválida', details: parsed.error.issues });
  try {
    return res.json(await getSalesAnalytics(parsed.data));
  } catch (error) {
    if (error instanceof SalesOperationError) return res.status(error.status).json({ error: error.message, code: error.code, ...error.details });
    console.error('Error de analítica de ventas:', error);
    return res.status(500).json({ error: 'Error interno de analítica de ventas', code: 'INTERNAL_ERROR' });
  }
}
