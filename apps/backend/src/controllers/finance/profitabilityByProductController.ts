import { Response } from 'express';
import { ZodType } from 'zod';
import { AuthenticatedRequest } from '../../middlewares/auth';
import { profitabilityByProductQuerySchema } from '../../schemas/finance/profitabilityByProductSchema';
import {
  getProfitabilityByProduct,
  ProfitabilityByProductOperationError,
} from '../../services/finance/profitabilityByProductService';

function parse<T>(schema: ZodType<T>, value: unknown, res: Response): T | null {
  const result = schema.safeParse(value);
  if (!result.success) {
    res.status(400).json({
      error: 'Solicitud de rentabilidad por producto inválida',
      code: 'VALIDATION_ERROR',
      details: result.error.issues,
    });
    return null;
  }
  return result.data;
}

function handle(error: unknown, res: Response) {
  if (error instanceof ProfitabilityByProductOperationError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      ...error.details,
    });
  }
  console.error('Error procesando rentabilidad por producto:', error);
  return res.status(500).json({
    error: 'Error interno procesando rentabilidad por producto',
    code: 'INTERNAL_ERROR',
  });
}

export async function getByProduct(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHENTICATED' });
  }

  const permissions = new Set(
    (req.user.permissions ?? []).map(p => p.trim().toLowerCase()),
  );
  const allowed =
    permissions.has('finance.profitability.view') ||
    permissions.has('accounting.read');
  if (!allowed) {
    return res.status(403).json({
      error: 'Permiso insuficiente para consultar rentabilidad por producto',
      code: 'FORBIDDEN',
    });
  }

  const query = parse(profitabilityByProductQuerySchema, req.query, res);
  if (!query) return;

  try {
    return res.json(await getProfitabilityByProduct(query));
  } catch (error) {
    return handle(error, res);
  }
}