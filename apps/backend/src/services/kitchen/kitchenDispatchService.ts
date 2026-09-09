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
export const KITCHEN_READY_RETENTION_MINUTES = 120;

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
  readyAt: true,
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
    readyAt: dispatch.readyAt?.toISOString() ?? null,
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
  const readyCutoff = new Date(
    Date.now() - KITCHEN_READY_RETENTION_MINUTES * 60_000,
  );
  const dispatches = await client.kitchenDispatch.findMany({
    where: {
      OR: [
        { status: { in: [KitchenDispatchStatus.NEXT, KitchenDispatchStatus.PREPARING] } },
        { status: KitchenDispatchStatus.READY, readyAt: { gte: readyCutoff } },
      ],
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

export async function getKitchenDispatch(
  dispatchId: number,
  client: KitchenClient = prisma,
) {
  return toKitchenDispatchDto(await requireKitchenDispatch(dispatchId, client));
}

export async function updateKitchenDispatchStatus(
  dispatchId: number,
  nextStatus: KitchenDispatchStatus,
) {
  return prisma.$transaction(async transaction => {
    const rows = await transaction.$queryRaw<Array<{
      status: KitchenDispatchStatus;
      startedAt: Date | null;
      readyAt: Date | null;
    }>>`
      SELECT "status", "startedAt", "readyAt"
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
          }
        : {
            status: nextStatus,
            startedAt: current.startedAt ?? now,
            readyAt: current.readyAt ?? now,
          },
    });

    return toKitchenDispatchDto(await requireKitchenDispatch(dispatchId, transaction));
  });
}
