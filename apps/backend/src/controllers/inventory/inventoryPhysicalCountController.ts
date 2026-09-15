import { Response } from 'express';
import { InventoryPhysicalCountStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../../middlewares/auth';
import {
  createPhysicalCountSchema,
  inventoryCountReferencesQuerySchema,
  listPhysicalCountsQuerySchema,
  updatePhysicalCountSchema,
} from '../../schemas/inventoryPhysicalCountSchema';
import {
  PhysicalCountError,
  cancelPhysicalCount,
  createPhysicalCount,
  getPhysicalCount,
  listPhysicalCounts,
  physicalCountReferences,
  postPhysicalCount,
  refreshPhysicalCount,
  updatePhysicalCount,
} from '../../services/inventoryPhysicalCountService';

function id(raw: string) {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new PhysicalCountError('INVALID_ID', 400, 'Id inválido');
  return parsed;
}

async function handle(res: Response, work: () => Promise<unknown>, status = 200) {
  try {
    return res.status(status).json(await work());
  } catch (error) {
    if (error instanceof PhysicalCountError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code, details: error.details });
    }
    console.error('Error en conteo físico:', error);
    return res.status(500).json({ error: 'Error interno al procesar el conteo físico' });
  }
}

function actor(req: AuthenticatedRequest) {
  if (!req.user?.id) throw new PhysicalCountError('NOT_AUTHENTICATED', 401, 'Usuario no autenticado');
  return req.user.id;
}

export const list = (req: AuthenticatedRequest, res: Response) => handle(res, async () => {
  const parsed = listPhysicalCountsQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new PhysicalCountError('INVALID_QUERY', 400, 'Filtros inválidos', parsed.error.flatten());
  return listPhysicalCounts({
    ...parsed.data,
    status: parsed.data.status as InventoryPhysicalCountStatus | undefined,
  });
});

export const get = (req: AuthenticatedRequest, res: Response) => handle(res, () => getPhysicalCount(id(req.params.id)));

export const references = (req: AuthenticatedRequest, res: Response) => handle(res, async () => {
  const parsed = inventoryCountReferencesQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new PhysicalCountError('INVALID_QUERY', 400, 'Filtros inválidos', parsed.error.flatten());
  return physicalCountReferences(parsed.data.warehouseId, parsed.data.search);
});

export const create = (req: AuthenticatedRequest, res: Response) => handle(res, async () => {
  const parsed = createPhysicalCountSchema.safeParse(req.body);
  if (!parsed.success) throw new PhysicalCountError('INVALID_BODY', 400, 'Datos inválidos', parsed.error.flatten());
  return createPhysicalCount(parsed.data, actor(req));
}, 201);

export const update = (req: AuthenticatedRequest, res: Response) => handle(res, async () => {
  const parsed = updatePhysicalCountSchema.safeParse(req.body);
  if (!parsed.success) throw new PhysicalCountError('INVALID_BODY', 400, 'Datos inválidos', parsed.error.flatten());
  return updatePhysicalCount(id(req.params.id), parsed.data, actor(req));
});

export const refresh = (req: AuthenticatedRequest, res: Response) => handle(res, () => refreshPhysicalCount(id(req.params.id), actor(req)));
export const post = (req: AuthenticatedRequest, res: Response) => handle(res, () => postPhysicalCount(id(req.params.id), actor(req)));
export const cancel = (req: AuthenticatedRequest, res: Response) => handle(res, () => cancelPhysicalCount(id(req.params.id), actor(req)));
