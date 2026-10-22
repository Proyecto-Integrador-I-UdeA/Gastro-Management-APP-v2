import { Response } from 'express';
import { ZodType } from 'zod';
import { AuthenticatedRequest } from '../../middlewares/auth';
import {
  createTransferSchema,
  listTransfersQuerySchema,
  transferIdSchema,
} from '../../schemas/finance/transferSchema';
import {
  createTransfer,
  getTransfer,
  getTransferReferences,
  listTransfers,
  TransferOperationError,
} from '../../services/finance/transferService';

function parse<T>(schema: ZodType<T>, value: unknown, res: Response): T | null {
  const result = schema.safeParse(value);
  if (!result.success) {
    res.status(400).json({
      error: 'Solicitud de transferencias inválida',
      code: 'VALIDATION_ERROR',
      details: result.error.issues,
    });
    return null;
  }
  return result.data;
}

function handle(error: unknown, res: Response) {
  if (error instanceof TransferOperationError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      ...error.details,
    });
  }
  console.error('Error procesando transferencias:', error);
  return res.status(500).json({
    error: 'Error interno procesando transferencias',
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

function transferId(req: AuthenticatedRequest, res: Response): number | null {
  return parse(transferIdSchema, req.params.id, res);
}

// ─── Endpoints ─────────────────────────────────────────────────────────────

export async function list(req: AuthenticatedRequest, res: Response) {
  if (!ensurePermission(req, res, 'finance.transfers.read')) return;
  const query = parse(listTransfersQuerySchema, req.query, res);
  if (!query) return;
  try {
    return res.json({ transfers: await listTransfers(query) });
  } catch (error) {
    return handle(error, res);
  }
}

export async function detail(req: AuthenticatedRequest, res: Response) {
  if (!ensurePermission(req, res, 'finance.transfers.read')) return;
  const id = transferId(req, res);
  if (id === null) return;
  try {
    return res.json(await getTransfer(id));
  } catch (error) {
    return handle(error, res);
  }
}

export async function create(req: AuthenticatedRequest, res: Response) {
  if (!ensurePermission(req, res, 'finance.transfers.create')) return;
  const input = parse(createTransferSchema, req.body ?? {}, res);
  const actor = actorId(req, res);
  if (!input || actor === null) return;
  try {
    return res.status(201).json(await createTransfer(input, actor));
  } catch (error) {
    return handle(error, res);
  }
}

export async function references(req: AuthenticatedRequest, res: Response) {
  if (!ensurePermission(req, res, 'finance.transfers.read')) return;
  try {
    return res.json(await getTransferReferences());
  } catch (error) {
    return handle(error, res);
  }
}