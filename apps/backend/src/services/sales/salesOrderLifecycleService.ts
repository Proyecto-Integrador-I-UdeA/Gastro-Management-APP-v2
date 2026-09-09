import {
  KitchenDispatchStatus,
  Prisma,
  PrismaClient,
  SalesOrderStatus,
} from '@prisma/client';
import prisma from '../../lib/prisma';
import {
  getSalesOrder,
  SalesOperationError,
} from './salesOrderService';

type SalesLifecycleClient = PrismaClient | Prisma.TransactionClient;

const readyPickupSelect = {
  id: true,
  salesOrderId: true,
  status: true,
  readyAt: true,
  deliveredAt: true,
  salesOrder: {
    select: {
      id: true,
      diningTable: {
        select: {
          id: true,
          code: true,
          area: true,
        },
      },
    },
  },
} satisfies Prisma.KitchenDispatchSelect;

type ReadyPickupRecord = Prisma.KitchenDispatchGetPayload<{
  select: typeof readyPickupSelect;
}>;

function toReadyPickupDto(dispatch: ReadyPickupRecord) {
  return {
    dispatchId: dispatch.id,
    salesOrderId: dispatch.salesOrderId,
    orderNumber: dispatch.salesOrder.id,
    table: dispatch.salesOrder.diningTable,
    status: dispatch.status,
    readyAt: dispatch.readyAt?.toISOString() ?? null,
    deliveredAt: dispatch.deliveredAt?.toISOString() ?? null,
    cancelled: false,
  };
}

export async function listReadyKitchenPickups(
  responsibleWaiterId: number,
  client: SalesLifecycleClient = prisma,
) {
  const dispatches = await client.kitchenDispatch.findMany({
    where: {
      dispatchedById: responsibleWaiterId,
      status: KitchenDispatchStatus.READY,
      deliveredAt: null,
      salesOrder: { status: SalesOrderStatus.OPEN },
    },
    orderBy: [{ readyAt: 'asc' }, { id: 'asc' }],
    select: readyPickupSelect,
  });

  return dispatches.map(toReadyPickupDto);
}

export async function deliverKitchenDispatch(
  orderId: number,
  dispatchId: number,
  deliveredById: number,
) {
  return prisma.$transaction(async transaction => {
    const orderRows = await transaction.$queryRaw<Array<{
      id: number;
      status: SalesOrderStatus;
    }>>`
      SELECT "id", "status"
      FROM "sales_orders"
      WHERE "id" = ${orderId}
      FOR UPDATE
    `;
    if (orderRows.length === 0) {
      throw new SalesOperationError('ORDER_NOT_FOUND', 404, 'Orden no encontrada');
    }

    const dispatchRows = await transaction.$queryRaw<Array<{
      id: number;
      status: KitchenDispatchStatus;
      deliveredAt: Date | null;
      deliveredById: number | null;
    }>>`
      SELECT "id", "status", "deliveredAt", "deliveredById"
      FROM "kitchen_dispatches"
      WHERE "id" = ${dispatchId} AND "salesOrderId" = ${orderId}
      FOR UPDATE
    `;
    if (dispatchRows.length === 0) {
      throw new SalesOperationError(
        'KITCHEN_DISPATCH_NOT_FOUND',
        404,
        'Envío a cocina no encontrado para esta orden',
      );
    }
    if (orderRows[0].status === SalesOrderStatus.VOIDED) {
      throw new SalesOperationError(
        'ORDER_CANCELLED',
        409,
        'La orden fue cancelada y no puede marcarse como entregada',
      );
    }
    if (orderRows[0].status !== SalesOrderStatus.OPEN) {
      throw new SalesOperationError('ORDER_NOT_OPEN', 409, 'La orden ya no está abierta');
    }

    const current = dispatchRows[0];
    if (current.deliveredAt === null) {
      if (current.status !== KitchenDispatchStatus.READY) {
        throw new SalesOperationError(
          'KITCHEN_DISPATCH_NOT_READY',
          409,
          'El envío todavía no está listo para entregar',
        );
      }
      await transaction.kitchenDispatch.update({
        where: { id: dispatchId },
        data: {
          deliveredAt: new Date(),
          deliveredById,
        },
      });
    }

    const delivered = await transaction.kitchenDispatch.findUniqueOrThrow({
      where: { id: dispatchId },
      select: {
        id: true,
        salesOrderId: true,
        status: true,
        readyAt: true,
        deliveredAt: true,
        deliveredBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    return {
      dispatchId: delivered.id,
      salesOrderId: delivered.salesOrderId,
      status: delivered.status,
      readyAt: delivered.readyAt?.toISOString() ?? null,
      deliveredAt: delivered.deliveredAt?.toISOString() ?? null,
      deliveredBy: delivered.deliveredBy,
    };
  });
}

export async function cancelSalesOrder(
  orderId: number,
  cancellationReason: string,
  cancelledById: number,
) {
  return prisma.$transaction(async transaction => {
    const orderRows = await transaction.$queryRaw<Array<{
      id: number;
      status: SalesOrderStatus;
    }>>`
      SELECT "id", "status"
      FROM "sales_orders"
      WHERE "id" = ${orderId}
      FOR UPDATE
    `;
    if (orderRows.length === 0) {
      throw new SalesOperationError('ORDER_NOT_FOUND', 404, 'Orden no encontrada');
    }

    if (orderRows[0].status === SalesOrderStatus.VOIDED) {
      return getSalesOrder(orderId, transaction);
    }
    if (orderRows[0].status !== SalesOrderStatus.OPEN) {
      throw new SalesOperationError('ORDER_NOT_OPEN', 409, 'La orden ya no está abierta');
    }

    const delivered = await transaction.kitchenDispatch.findFirst({
      where: {
        salesOrderId: orderId,
        deliveredAt: { not: null },
      },
      select: { id: true },
    });
    if (delivered) {
      throw new SalesOperationError(
        'ORDER_HAS_DELIVERED_DISPATCHES',
        409,
        'No se puede cancelar completamente una orden con entregas confirmadas',
        { dispatchId: delivered.id },
      );
    }

    await transaction.salesOrder.update({
      where: { id: orderId },
      data: {
        status: SalesOrderStatus.VOIDED,
        voidedAt: new Date(),
        cancelledById,
        cancellationReason,
      },
    });

    return getSalesOrder(orderId, transaction);
  });
}
