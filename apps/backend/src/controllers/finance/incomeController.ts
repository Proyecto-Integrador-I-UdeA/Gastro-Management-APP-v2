import { Response } from 'express';
import { ZodType } from 'zod';
import { AuthenticatedRequest } from '../../middlewares/auth';
import { incomeSummaryQuerySchema } from '../../schemas/finance/incomeSchema';
import {
  getIncomeSummary,
  IncomeOperationError,
} from '../../services/finance/incomeService';

function parse<T>(schema: ZodType<T>, value: unknown, res: Response): T | null {
  const result = schema.safeParse(value);
  if (!result.success) {
    res.status(400).json({
      error: 'Solicitud de ingresos inválida',
      code: 'VALIDATION_ERROR',
      details: result.error.issues,
    });
    return null;
  }
  return result.data;
}

function handle(error: unknown, res: Response) {
  if (error instanceof IncomeOperationError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      ...error.details,
    });
  }
  console.error('Error procesando ingresos:', error);
  return res.status(500).json({
    error: 'Error interno procesando ingresos',
    code: 'INTERNAL_ERROR',
  });
}

export async function getSummary(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHENTICATED' });
  }

  const permissions = new Set(
    (req.user.permissions ?? []).map(permission => permission.trim().toLowerCase()),
  );
  const allowed =
    permissions.has('finance.income.view') ||
    permissions.has('accounting.read');
  if (!allowed) {
    return res.status(403).json({
      error: 'Permiso insuficiente para consultar ingresos',
      code: 'FORBIDDEN',
    });
  }

  const query = parse(incomeSummaryQuerySchema, req.query, res);
  if (!query) return;

  try {
    return res.json(await getIncomeSummary(query));
  } catch (error) {
    return handle(error, res);
  }
}