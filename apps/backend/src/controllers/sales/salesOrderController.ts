import { Response } from 'express';
import { ZodType } from 'zod';
import { AuthenticatedRequest } from '../../middlewares/auth';
import {
  addExistingOrderItemAdditionSchema,
  addOrderItemSchema,
  createDiningTableSchema,
  emptySalesMutationSchema,
  openTableOrderSchema,
  positiveIdParamSchema,
  updateOrderGuestCountSchema,
  updateOrderItemSchema,
  updateDiningTableSchema,
} from '../../schemas/salesOrderSchema';
import {
  addSalesOrderItem,
  addSalesOrderItemAddition,
  createSalesTable,
  deleteSalesOrderItem,
  getActiveSalesOrderByTable,
  getSalesOrder,
  listSalesTables,
  openSalesTable,
  requestSalesOrderBill,
  SalesOperationError,
  updateSalesOrderGuestCount,
  updateSalesOrderItem,
  updateSalesTable,
} from '../../services/sales/salesOrderService';

function parseId(rawId: string, field: string, res: Response): number | null {
  const validation = positiveIdParamSchema.safeParse(rawId);
  if (!validation.success) {
    res.status(400).json({
      error: `${field} debe ser un entero positivo`,
      code: 'VALIDATION_ERROR',
      details: validation.error.issues,
    });
    return null;
  }
  return validation.data;
}

function parseBody<T>(schema: ZodType<T>, body: unknown, res: Response): T | null {
  const validation = schema.safeParse(body ?? {});
  if (!validation.success) {
    res.status(400).json({
      error: 'Solicitud de ventas inválida',
      code: 'VALIDATION_ERROR',
      details: validation.error.issues,
    });
    return null;
  }
  return validation.data;
}

function actorId(req: AuthenticatedRequest, res: Response): number | null {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return req.user.id;
}

function handleSalesError(error: unknown, res: Response) {
  if (error instanceof SalesOperationError) {
    return res.status(error.status).json({
      error: error.message,
      code: error.code,
      ...error.details,
    });
  }

  console.error('Error procesando operación de mesas y pedidos:', error);
  return res.status(500).json({
    error: 'Error interno procesando la operación de ventas',
    code: 'INTERNAL_ERROR',
  });
}

export const listTables = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    return res.json({ tables: await listSalesTables() });
  } catch (error) {
    return handleSalesError(error, res);
  }
};

export const createTable = async (req: AuthenticatedRequest, res: Response) => {
  const input = parseBody(createDiningTableSchema, req.body, res);
  if (!input) return;

  try {
    return res.status(201).json(await createSalesTable(input));
  } catch (error) {
    return handleSalesError(error, res);
  }
};

export const updateTable = async (req: AuthenticatedRequest, res: Response) => {
  const tableId = parseId(req.params.tableId, 'tableId', res);
  if (tableId === null) return;
  const input = parseBody(updateDiningTableSchema, req.body, res);
  if (!input) return;

  try {
    return res.json(await updateSalesTable(tableId, input));
  } catch (error) {
    return handleSalesError(error, res);
  }
};

export const openTable = async (req: AuthenticatedRequest, res: Response) => {
  const tableId = parseId(req.params.tableId, 'tableId', res);
  if (tableId === null) return;
  const input = parseBody(openTableOrderSchema, req.body, res);
  if (!input) return;
  const openedById = actorId(req, res);
  if (openedById === null) return;

  try {
    return res.status(201).json(await openSalesTable(
      tableId,
      input.guestCount,
      openedById,
    ));
  } catch (error) {
    return handleSalesError(error, res);
  }
};

export const getActiveOrder = async (req: AuthenticatedRequest, res: Response) => {
  const tableId = parseId(req.params.tableId, 'tableId', res);
  if (tableId === null) return;

  try {
    return res.json(await getActiveSalesOrderByTable(tableId));
  } catch (error) {
    return handleSalesError(error, res);
  }
};

export const getOrder = async (req: AuthenticatedRequest, res: Response) => {
  const orderId = parseId(req.params.orderId, 'orderId', res);
  if (orderId === null) return;

  try {
    return res.json(await getSalesOrder(orderId));
  } catch (error) {
    return handleSalesError(error, res);
  }
};

export const addOrderItem = async (req: AuthenticatedRequest, res: Response) => {
  const orderId = parseId(req.params.orderId, 'orderId', res);
  if (orderId === null) return;
  const input = parseBody(addOrderItemSchema, req.body, res);
  if (!input) return;
  const addedById = actorId(req, res);
  if (addedById === null) return;

  try {
    return res.status(201).json(await addSalesOrderItem(orderId, input, addedById));
  } catch (error) {
    return handleSalesError(error, res);
  }
};

export const addOrderItemAddition = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  const orderId = parseId(req.params.orderId, 'orderId', res);
  const itemId = parseId(req.params.itemId, 'itemId', res);
  if (orderId === null || itemId === null) return;
  const input = parseBody(addExistingOrderItemAdditionSchema, req.body, res);
  if (!input) return;
  const addedById = actorId(req, res);
  if (addedById === null) return;

  try {
    return res.status(201).json(await addSalesOrderItemAddition(
      orderId,
      itemId,
      input,
      addedById,
    ));
  } catch (error) {
    return handleSalesError(error, res);
  }
};

export const updateOrderItem = async (req: AuthenticatedRequest, res: Response) => {
  const orderId = parseId(req.params.orderId, 'orderId', res);
  const itemId = parseId(req.params.itemId, 'itemId', res);
  if (orderId === null || itemId === null) return;
  const input = parseBody(updateOrderItemSchema, req.body, res);
  if (!input) return;

  try {
    return res.json(await updateSalesOrderItem(orderId, itemId, input));
  } catch (error) {
    return handleSalesError(error, res);
  }
};

export const deleteOrderItem = async (req: AuthenticatedRequest, res: Response) => {
  const orderId = parseId(req.params.orderId, 'orderId', res);
  const itemId = parseId(req.params.itemId, 'itemId', res);
  if (orderId === null || itemId === null) return;

  try {
    return res.json(await deleteSalesOrderItem(orderId, itemId));
  } catch (error) {
    return handleSalesError(error, res);
  }
};

export const updateGuestCount = async (req: AuthenticatedRequest, res: Response) => {
  const orderId = parseId(req.params.orderId, 'orderId', res);
  if (orderId === null) return;
  const input = parseBody(updateOrderGuestCountSchema, req.body, res);
  if (!input) return;

  try {
    return res.json(await updateSalesOrderGuestCount(orderId, input.guestCount));
  } catch (error) {
    return handleSalesError(error, res);
  }
};

export const requestBill = async (req: AuthenticatedRequest, res: Response) => {
  const orderId = parseId(req.params.orderId, 'orderId', res);
  if (orderId === null) return;
  if (!parseBody(emptySalesMutationSchema, req.body, res)) return;

  try {
    return res.json(await requestSalesOrderBill(orderId));
  } catch (error) {
    return handleSalesError(error, res);
  }
};
