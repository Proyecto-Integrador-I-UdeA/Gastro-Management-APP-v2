import {
  KitchenDispatchStatus,
  Prisma,
  PrismaClient,
  SalesOrderStatus,
} from '@prisma/client';
import prisma from '../../lib/prisma';
import { SalesOperationError } from '../sales/salesOrderService';

type KitchenClient = PrismaClient | Prisma.TransactionClient;

export const KITCHEN_PREP_TIME_MINUTES = 15;
export const KITCHEN_WARNING_THRESHOLD_MINUTES = 5;

const KITCHEN_STATUS_PRIORITY: Record<KitchenDispatchStatus, number> = {
  [KitchenDispatchStatus.NEXT]: 0,
  [KitchenDispatchStatus.PREPARING]: 1,
  [KitchenDispatchStatus.READY]: 2,
};

const kitchenDispatchDetailSelect = {
  id: true,
  status: true,
  dispatchedAt: true,
  prepTimeMinutesSnapshot: true,
  targetReadyAt: true,
  startedAt: true,
  startedBy: {
    select: {
      id: true,
      fullName: true,
    },
  },
  readyAt: true,
  readyBy: {
    select: {
      id: true,
      fullName: true,
    },
  },
  deliveredAt: true,
  deliveredBy: {
    select: {
      id: true,
      fullName: true,
    },
  },
  salesOrder: {
    select: {
      id: true,
      openedAt: true,
      diningTable: {
        select: {
          id: true,
          code: true,
          area: true,
        },
      },
    },
  },
  dispatchedBy: {
    select: {
      id: true,
      fullName: true,
    },
  },
  items: {
    orderBy: { id: 'asc' as const },
    select: {
      id: true,
      salesOrderItemId: true,
      parentDispatchItemId: true,
      itemNameSnapshot: true,
      quantitySnapshot: true,
      specialInstructionsSnapshot: true,
    },
  },
} satisfies Prisma.KitchenDispatchSelect;

type KitchenDispatchRecord = Prisma.KitchenDispatchGetPayload<{
  select: typeof kitchenDispatchDetailSelect;
}>;

type KitchenDispatchItemRecord = KitchenDispatchRecord['items'][number];

function toKitchenItemDto(item: KitchenDispatchItemRecord) {
  return {
    id: item.id,
    salesOrderItemId: item.salesOrderItemId,
    name: item.itemNameSnapshot,
    quantity: item.quantitySnapshot,
    specialInstructions: item.specialInstructionsSnapshot,
  };
}

export function toKitchenDispatchDto(dispatch: KitchenDispatchRecord) {
  const additionsByParent = new Map<number, KitchenDispatchItemRecord[]>();
  for (const item of dispatch.items) {
    if (item.parentDispatchItemId !== null) {
      const additions = additionsByParent.get(item.parentDispatchItemId) ?? [];
      additions.push(item);
      additionsByParent.set(item.parentDispatchItemId, additions);
    }
  }

  return {
    id: dispatch.id,
    dispatchNumber: dispatch.id,
    orderId: dispatch.salesOrder.id,
    orderNumber: dispatch.salesOrder.id,
    orderOpenedAt: dispatch.salesOrder.openedAt.toISOString(),
    table: dispatch.salesOrder.diningTable,
    status: dispatch.status,
    dispatchedBy: dispatch.dispatchedBy,
    dispatchedAt: dispatch.dispatchedAt.toISOString(),
    prepTimeMinutesSnapshot: dispatch.prepTimeMinutesSnapshot,
    warningThresholdMinutes: KITCHEN_WARNING_THRESHOLD_MINUTES,
    targetReadyAt: dispatch.targetReadyAt.toISOString(),
    startedAt: dispatch.startedAt?.toISOString() ?? null,
    startedBy: dispatch.startedBy,
    readyAt: dispatch.readyAt?.toISOString() ?? null,
    readyBy: dispatch.readyBy,
    deliveredAt: dispatch.deliveredAt?.toISOString() ?? null,
    deliveredBy: dispatch.deliveredBy,
    items: dispatch.items
      .filter(item => item.parentDispatchItemId === null)
      .map(item => ({
        ...toKitchenItemDto(item),
        additions: (additionsByParent.get(item.id) ?? []).map(toKitchenItemDto),
      })),
  };
}

async function findKitchenDispatch(dispatchId: number, client: KitchenClient) {
  return client.kitchenDispatch.findUnique({
    where: { id: dispatchId },
    select: kitchenDispatchDetailSelect,
  });
}

async function requireKitchenDispatch(dispatchId: number, client: KitchenClient) {
  const dispatch = await findKitchenDispatch(dispatchId, client);
  if (!dispatch) {
    throw new SalesOperationError(
      'KITCHEN_DISPATCH_NOT_FOUND',
      404,
      'Envío a cocina no encontrado',
    );
  }
  return dispatch;
}

async function lockOpenOrder(
  transaction: Prisma.TransactionClient,
  orderId: number,
) {
  const rows = await transaction.$queryRaw<Array<{
    id: number;
    status: SalesOrderStatus;
  }>>`
    SELECT "id", "status"
    FROM "sales_orders"
    WHERE "id" = ${orderId}
    FOR UPDATE
  `;

  if (rows.length === 0) {
    throw new SalesOperationError('ORDER_NOT_FOUND', 404, 'Orden no encontrada');
  }
  if (rows[0].status !== SalesOrderStatus.OPEN) {
    throw new SalesOperationError('ORDER_NOT_OPEN', 409, 'La orden ya no está abierta');
  }
}

export async function sendSalesOrderToKitchen(
  orderId: number,
  dispatchedById: number,
) {
  try {
    return await prisma.$transaction(async transaction => {
      await lockOpenOrder(transaction, orderId);

    const order = await transaction.salesOrder.findUnique({
      where: { id: orderId },
      select: {
        items: {
          where: {
            parentItemId: null,
            kitchenDispatchItem: null,
          },
          orderBy: { id: 'asc' },
          select: {
            id: true,
            menuItemNameSnapshot: true,
            quantity: true,
            specialInstructions: true,
            additions: {
              where: { kitchenDispatchItem: null },
              orderBy: { id: 'asc' },
              select: {
                id: true,
                menuItemNameSnapshot: true,
                quantity: true,
                specialInstructions: true,
              },
            },
          },
        },
      },
    });

    if (!order || order.items.length === 0) {
      throw new SalesOperationError(
        'NO_PENDING_KITCHEN_ITEMS',
        409,
        'La orden no tiene productos pendientes por enviar a cocina',
      );
    }

    const dispatchedAt = new Date();
    const targetReadyAt = new Date(
      dispatchedAt.getTime() + KITCHEN_PREP_TIME_MINUTES * 60_000,
    );
    const dispatch = await transaction.kitchenDispatch.create({
      data: {
        salesOrderId: orderId,
        dispatchedById,
        dispatchedAt,
        prepTimeMinutesSnapshot: KITCHEN_PREP_TIME_MINUTES,
        targetReadyAt,
      },
      select: { id: true },
    });

    for (const item of order.items) {
      const principalSnapshot = await transaction.kitchenDispatchItem.create({
        data: {
          kitchenDispatchId: dispatch.id,
          salesOrderItemId: item.id,
          itemNameSnapshot: item.menuItemNameSnapshot,
          quantitySnapshot: item.quantity,
          specialInstructionsSnapshot: item.specialInstructions,
        },
        select: { id: true },
      });

      if (item.additions.length > 0) {
        await transaction.kitchenDispatchItem.createMany({
          data: item.additions.map(addition => ({
            kitchenDispatchId: dispatch.id,
            salesOrderItemId: addition.id,
            parentDispatchItemId: principalSnapshot.id,
            itemNameSnapshot: addition.menuItemNameSnapshot,
            quantitySnapshot: addition.quantity,
            specialInstructionsSnapshot: addition.specialInstructions,
          })),
        });
      }
    }

      return toKitchenDispatchDto(await requireKitchenDispatch(dispatch.id, transaction));
    });
  } catch (error) {
    if (error instanceof SalesOperationError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new SalesOperationError(
        'ORDER_ITEM_ALREADY_SENT_TO_KITCHEN',
        409,
        'Una línea de la orden ya fue enviada a cocina',
      );
    }
    throw error;
  }
}

export async function listKitchenDispatches(client: KitchenClient = prisma) {
  const dispatches = await client.kitchenDispatch.findMany({
    where: {
      deliveredAt: null,
      salesOrder: { status: SalesOrderStatus.OPEN },
    },
    select: kitchenDispatchDetailSelect,
  });
  return dispatches
    .sort((left, right) => (
      KITCHEN_STATUS_PRIORITY[left.status] - KITCHEN_STATUS_PRIORITY[right.status]
      || left.dispatchedAt.getTime() - right.dispatchedAt.getTime()
      || left.id - right.id
    ))
    .map(toKitchenDispatchDto);
}

const kitchenCancellationSelect = {
  id: true,
  voidedAt: true,
  cancellationReason: true,
  cancellationAcknowledgedAt: true,
  diningTable: {
    select: {
      id: true,
      code: true,
      area: true,
    },
  },
  cancelledBy: {
    select: {
      id: true,
      fullName: true,
    },
  },
  cancellationAcknowledgedBy: {
    select: {
      id: true,
      fullName: true,
    },
  },
  kitchenDispatches: {
    where: { deliveredAt: null },
    orderBy: { id: 'asc' as const },
    select: {
      id: true,
      status: true,
    },
  },
} satisfies Prisma.SalesOrderSelect;

type KitchenCancellationRecord = Prisma.SalesOrderGetPayload<{
  select: typeof kitchenCancellationSelect;
}>;

function toKitchenCancellationDto(order: KitchenCancellationRecord) {
  return {
    orderId: order.id,
    orderNumber: order.id,
    table: order.diningTable,
    cancelledAt: order.voidedAt?.toISOString() ?? null,
    cancelledBy: order.cancelledBy,
    cancellationReason: order.cancellationReason,
    cancellationAcknowledgedAt:
      order.cancellationAcknowledgedAt?.toISOString() ?? null,
    cancellationAcknowledgedBy: order.cancellationAcknowledgedBy,
    affectedDispatches: order.kitchenDispatches,
  };
}

export async function listKitchenCancellationAlerts(
  client: KitchenClient = prisma,
) {
  const orders = await client.salesOrder.findMany({
    where: {
      status: SalesOrderStatus.VOIDED,
      voidedAt: { not: null },
      cancelledById: { not: null },
      cancellationReason: { not: null },
      cancellationAcknowledgedAt: null,
      kitchenDispatches: { some: { deliveredAt: null } },
    },
    orderBy: [{ voidedAt: 'asc' }, { id: 'asc' }],
    select: kitchenCancellationSelect,
  });
  return orders.map(toKitchenCancellationDto);
}

async function requireKitchenCancellation(
  orderId: number,
  client: KitchenClient,
) {
  const order = await client.salesOrder.findUnique({
    where: { id: orderId },
    select: kitchenCancellationSelect,
  });
  if (
    !order
    || order.voidedAt === null
    || order.cancellationReason === null
    || order.kitchenDispatches.length === 0
  ) {
    throw new SalesOperationError(
      'KITCHEN_CANCELLATION_NOT_FOUND',
      404,
      'Cancelación de cocina no encontrada',
    );
  }
  return order;
}

export async function acknowledgeKitchenCancellation(
  orderId: number,
  acknowledgedById: number,
) {
  return prisma.$transaction(async transaction => {
    const rows = await transaction.$queryRaw<Array<{
      id: number;
      status: SalesOrderStatus;
      cancellationAcknowledgedAt: Date | null;
    }>>`
      SELECT "id", "status", "cancellationAcknowledgedAt"
      FROM "sales_orders"
      WHERE "id" = ${orderId}
      FOR UPDATE
    `;
    if (rows.length === 0 || rows[0].status !== SalesOrderStatus.VOIDED) {
      throw new SalesOperationError(
        'KITCHEN_CANCELLATION_NOT_FOUND',
        404,
        'Cancelación de cocina no encontrada',
      );
    }

    await requireKitchenCancellation(orderId, transaction);
    if (rows[0].cancellationAcknowledgedAt === null) {
      await transaction.salesOrder.update({
        where: { id: orderId },
        data: {
          cancellationAcknowledgedAt: new Date(),
          cancellationAcknowledgedById: acknowledgedById,
        },
      });
    }
    return toKitchenCancellationDto(
      await requireKitchenCancellation(orderId, transaction),
    );
  });
}

export async function getKitchenDispatch(
  dispatchId: number,
  client: KitchenClient = prisma,
) {
  return toKitchenDispatchDto(await requireKitchenDispatch(dispatchId, client));
}

export async function updateKitchenDispatchStatus(
  dispatchId: number,
  nextStatus: KitchenDispatchStatus,
  actorId: number,
) {
  return prisma.$transaction(async transaction => {
    const dispatchReference = await transaction.kitchenDispatch.findUnique({
      where: { id: dispatchId },
      select: { salesOrderId: true },
    });
    if (!dispatchReference) {
      throw new SalesOperationError(
        'KITCHEN_DISPATCH_NOT_FOUND',
        404,
        'Envío a cocina no encontrado',
      );
    }
    const orderRows = await transaction.$queryRaw<Array<{
      status: SalesOrderStatus;
    }>>`
      SELECT "status"
      FROM "sales_orders"
      WHERE "id" = ${dispatchReference.salesOrderId}
      FOR UPDATE
    `;
    const rows = await transaction.$queryRaw<Array<{
      status: KitchenDispatchStatus;
      startedAt: Date | null;
      startedById: number | null;
      readyAt: Date | null;
      readyById: number | null;
      deliveredAt: Date | null;
    }>>`
      SELECT
        "status",
        "startedAt",
        "startedById",
        "readyAt",
        "readyById",
        "deliveredAt"
      FROM "kitchen_dispatches"
      WHERE "id" = ${dispatchId}
      FOR UPDATE
    `;

    if (rows.length === 0) {
      throw new SalesOperationError(
        'KITCHEN_DISPATCH_NOT_FOUND',
        404,
        'Envío a cocina no encontrado',
      );
    }

    const current = rows[0];
    const orderStatus = orderRows[0]?.status;
    if (orderStatus === SalesOrderStatus.VOIDED) {
      throw new SalesOperationError(
        'ORDER_CANCELLED',
        409,
        'La orden fue cancelada y no puede continuar en preparación',
      );
    }
    if (orderStatus !== SalesOrderStatus.OPEN || current.deliveredAt !== null) {
      throw new SalesOperationError(
        'KITCHEN_DISPATCH_NOT_ACTIVE',
        409,
        'El envío ya no está activo en cocina',
      );
    }
    if (current.status === nextStatus) {
      return toKitchenDispatchDto(await requireKitchenDispatch(dispatchId, transaction));
    }

    const transitionAllowed = (
      current.status === KitchenDispatchStatus.NEXT
      && nextStatus === KitchenDispatchStatus.PREPARING
    ) || (
      current.status === KitchenDispatchStatus.PREPARING
      && nextStatus === KitchenDispatchStatus.READY
    );
    if (!transitionAllowed) {
      throw new SalesOperationError(
        'INVALID_KITCHEN_STATUS_TRANSITION',
        409,
        'La transición de estado de cocina no está permitida',
        { from: current.status, to: nextStatus },
      );
    }

    const now = new Date();
    await transaction.kitchenDispatch.update({
      where: { id: dispatchId },
      data: nextStatus === KitchenDispatchStatus.PREPARING
        ? {
            status: nextStatus,
            startedAt: current.startedAt ?? now,
            startedById: current.startedById ?? actorId,
          }
        : {
            status: nextStatus,
            startedAt: current.startedAt ?? now,
            startedById: current.startedById ?? actorId,
            readyAt: current.readyAt ?? now,
            readyById: current.readyById ?? actorId,
          },
    });

    return toKitchenDispatchDto(await requireKitchenDispatch(dispatchId, transaction));
  });
}
