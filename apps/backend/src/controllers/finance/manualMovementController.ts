import { Response } from 'express';
import { ZodType } from 'zod';
import { AuthenticatedRequest } from '../../middlewares/auth';
import {
  cancelManualMovementSchema,
  createManualMovementSchema,
  listManualMovementsQuerySchema,
  manualMovementIdSchema,
  manualMovementSummaryQuerySchema,
  updateManualMovementSchema,
} from '../../schemas/finance/manualMovementSchema';
import {
  cancelManualMovement,
  confirmManualMovement,
  createManualMovement,
  getManualMovement,
  getManualMovementReferences,
  getManualMovementSummary,
  listManualMovements,
  ManualMovementOperationError,
  updateManualMovement,
} from '../../services/finance/manualMovementService';

function parse<T>(schema: ZodType<T>, value: unknown, res: Response): T | null {
  const result = schema.safeParse(value);
  if (!result.success) {
    res.status(400).json({
      error: 'Solicitud de movimientos inválida',
      code: 'VALIDATION_ERROR',
      details: result.error.issues,
    });
    return null;
  }
  return result.data;
}

function handle(error: unknown, res: Response) {
  if (error instanceof ManualMovementOperationError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      ...error.details,
    });
  }
  console.error('Error procesando movimientos:', error);
  return res.status(500).json({
    error: 'Error interno procesando movimientos',
    code: 'INTERNAL_ERROR',
  });
}

function actorId(req: AuthenticatedRequest, res: Response): number | null {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHENTICATED' });
    return null;
  }
  return req.user.id;
}

function permissions(req: AuthenticatedRequest): Set<string> {
  return new Set(
    (req.user?.permissions ?? []).map(p => p.trim().toLowerCase()),
  );
}

function ensurePermission(
  req: AuthenticatedRequest,
  res: Response,
  permission: string,
): boolean {
  const allowed =
    permissions(req).has(permission) ||
    permissions(req).has('accounting.read');
  if (!allowed) {
    res.status(403).json({
      error: 'Permiso insuficiente para esta operación',
      code: 'FORBIDDEN',
      required: permission,
    });
    return false;
  }
  return true;
}

function movementId(req: AuthenticatedRequest, res: Response): number | null {
  return parse(manualMovementIdSchema, req.params.id, res);
}

// ─── Endpoints ─────────────────────────────────────────────────────────────

export async function list(req: AuthenticatedRequest, res: Response) {
  if (!ensurePermission(req, res, 'finance.movements.read')) return;
  const query = parse(listManualMovementsQuerySchema, req.query, res);
  if (!query) return;
  try {
    return res.json({ movements: await listManualMovements(query) });
  } catch (error) {
    return handle(error, res);
  }
}

export async function detail(req: AuthenticatedRequest, res: Response) {
  if (!ensurePermission(req, res, 'finance.movements.read')) return;
  const id = movementId(req, res);
  if (id === null) return;
  try {
    return res.json(await getManualMovement(id));
  } catch (error) {
    return handle(error, res);
  }
}

export async function create(req: AuthenticatedRequest, res: Response) {
  if (!ensurePermission(req, res, 'finance.movements.create')) return;
  const input = parse(createManualMovementSchema, req.body ?? {}, res);
  const actor = actorId(req, res);
  if (!input || actor === null) return;
  try {
    return res.status(201).json(await createManualMovement(input, actor));
  } catch (error) {
    return handle(error, res);
  }
}

export async function update(req: AuthenticatedRequest, res: Response) {
  if (!ensurePermission(req, res, 'finance.movements.update')) return;
  const id = movementId(req, res);
  if (id === null) return;
  const input = parse(updateManualMovementSchema, req.body ?? {}, res);
  const actor = actorId(req, res);
  if (!input || actor === null) return;
  try {
    return res.json(await updateManualMovement(id, input, actor));
  } catch (error) {
    return handle(error, res);
  }
}

export async function confirm(req: AuthenticatedRequest, res: Response) {
  if (!ensurePermission(req, res, 'finance.movements.update')) return;
  const id = movementId(req, res);
  if (id === null) return;
  const actor = actorId(req, res);
  if (actor === null) return;
  try {
    return res.json(await confirmManualMovement(id, actor));
  } catch (error) {
    return handle(error, res);
  }
}

export async function cancel(req: AuthenticatedRequest, res: Response) {
  if (!ensurePermission(req, res, 'finance.movements.cancel')) return;
  const id = movementId(req, res);
  if (id === null) return;
  const input = parse(cancelManualMovementSchema, req.body ?? {}, res);
  const actor = actorId(req, res);
  if (!input || actor === null) return;
  try {
    return res.json(await cancelManualMovement(id, input.reason, actor));
  } catch (error) {
    return handle(error, res);
  }
}

export async function summary(req: AuthenticatedRequest, res: Response) {
  if (!ensurePermission(req, res, 'finance.movements.read')) return;
  const query = parse(manualMovementSummaryQuerySchema, req.query, res);
  if (!query) return;
  try {
    return res.json(await getManualMovementSummary(query));
  } catch (error) {
    return handle(error, res);
  }
}

export async function references(req: AuthenticatedRequest, res: Response) {
  if (!ensurePermission(req, res, 'finance.movements.read')) return;
  try {
    return res.json(await getManualMovementReferences());
  } catch (error) {
    return handle(error, res);
  }
}