import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middlewares/auth';
import { positiveIdParamSchema } from '../../schemas/salesOrderSchema';
import {
  emptyKitchenMutationSchema,
  kitchenDispatchStatusSchema,
} from '../../schemas/kitchenDispatchSchema';
import {
  acknowledgeKitchenCancellation,
  getKitchenDispatch,
  listKitchenCancellationAlerts,
  listKitchenDispatches,
  updateKitchenDispatchStatus,
} from '../../services/kitchen/kitchenDispatchService';
import { SalesOperationError } from '../../services/sales/salesOrderService';

function parseId(raw: string, res: Response): number | null {
  const result = positiveIdParamSchema.safeParse(raw);
  if (!result.success) {
    res.status(400).json({
      error: 'Identificador de envío a cocina inválido',
      code: 'VALIDATION_ERROR',
      details: result.error.issues,
    });
    return null;
  }
  return result.data;
}

function actorId(req: AuthenticatedRequest, res: Response): number | null {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return req.user.id;
}

function handleKitchenError(error: unknown, res: Response) {
  if (error instanceof SalesOperationError) {
    return res.status(error.status).json({
      error: error.message,
      code: error.code,
      ...error.details,
    });
  }
  console.error('Error procesando operación de cocina:', error);
  return res.status(500).json({
    error: 'Error interno procesando la operación de cocina',
    code: 'INTERNAL_ERROR',
  });
}

export const listDispatches = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [dispatches, cancellations] = await Promise.all([
      listKitchenDispatches(),
      listKitchenCancellationAlerts(),
    ]);
    return res.json({ dispatches, cancellations });
  } catch (error) {
    return handleKitchenError(error, res);
  }
};

export const getDispatch = async (req: AuthenticatedRequest, res: Response) => {
  const dispatchId = parseId(req.params.dispatchId, res);
  if (dispatchId === null) return;
  try {
    return res.json(await getKitchenDispatch(dispatchId));
  } catch (error) {
    return handleKitchenError(error, res);
  }
};

export const updateDispatchStatus = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const dispatchId = parseId(req.params.dispatchId, res);
  if (dispatchId === null) return;
  const input = kitchenDispatchStatusSchema.safeParse(req.body ?? {});
  if (!input.success) {
    return res.status(400).json({
      error: 'Estado de cocina inválido',
      code: 'VALIDATION_ERROR',
      details: input.error.issues,
    });
  }
  const updatedById = actorId(req, res);
  if (updatedById === null) return;
  try {
    return res.json(await updateKitchenDispatchStatus(
      dispatchId,
      input.data.status,
      updatedById,
    ));
  } catch (error) {
    return handleKitchenError(error, res);
  }
};

export const acknowledgeCancellation = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const orderId = parseId(req.params.orderId, res);
  if (orderId === null) return;
  const input = emptyKitchenMutationSchema.safeParse(req.body ?? {});
  if (!input.success) {
    return res.status(400).json({
      error: 'Solicitud de cocina inválida',
      code: 'VALIDATION_ERROR',
      details: input.error.issues,
    });
  }
  const acknowledgedById = actorId(req, res);
  if (acknowledgedById === null) return;
  try {
    return res.json(await acknowledgeKitchenCancellation(
      orderId,
      acknowledgedById,
    ));
  } catch (error) {
    return handleKitchenError(error, res);
  }
};
