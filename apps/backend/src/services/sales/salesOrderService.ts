import {
  KitchenDispatchStatus,
  MenuItemKind,
  Prisma,
  PrismaClient,
  SalesOrderStatus,
} from '@prisma/client';
import prisma from '../../lib/prisma';
import type {
  AddExistingOrderItemAdditionInput,
  AddOrderItemInput,
  CreateDiningTableInput,
  UpdateDiningTableInput,
  UpdateOrderItemInput,
} from '../../schemas/salesOrderSchema';
import { currentPublishedMenuItemPriceWhere } from './salesCommercialPolicy';

type SalesClient = PrismaClient | Prisma.TransactionClient;

const kitchenDispatchItemStateSelect = {
  kitchenDispatchId: true,
  kitchenDispatch: {
    select: {
      status: true,
      dispatchedAt: true,
    },
  },
} satisfies Prisma.KitchenDispatchItemSelect;

type KitchenAwareOrderItem = {
  id: number;
  parentItemId: number | null;
  kitchenDispatchItem: {
    kitchenDispatchId: number;
    kitchenDispatch: {
      status: KitchenDispatchStatus;
      dispatchedAt: Date;
    };
  } | null;
};

function kitchenSummary(items: readonly KitchenAwareOrderItem[]) {
  const dispatches = new Map<number, {
    id: number;
    status: KitchenDispatchStatus;
    dispatchedAt: Date;
  }>();

  for (const item of items) {
    if (item.kitchenDispatchItem) {
      const { kitchenDispatchId, kitchenDispatch } = item.kitchenDispatchItem;
      dispatches.set(kitchenDispatchId, {
        id: kitchenDispatchId,
        ...kitchenDispatch,
      });
    }
  }

  const orderedDispatches = Array.from(dispatches.values()).sort((left, right) => (
    right.dispatchedAt.getTime() - left.dispatchedAt.getTime()
    || right.id - left.id
  ));
  const latestDispatch = orderedDispatches[0] ?? null;
  const aggregateKitchenStatus = dispatches.size === 0
    ? null
    : orderedDispatches.some(dispatch => dispatch.status === KitchenDispatchStatus.PREPARING)
      ? KitchenDispatchStatus.PREPARING
      : orderedDispatches.some(dispatch => dispatch.status === KitchenDispatchStatus.NEXT)
        ? KitchenDispatchStatus.NEXT
        : KitchenDispatchStatus.READY;
  const pendingKitchenItemCount = items.filter(
    item => item.kitchenDispatchItem === null,
  ).length;

  return {
    hasPendingKitchenItems: pendingKitchenItemCount > 0,
    pendingKitchenItemCount,
    kitchenDispatchCount: dispatches.size,
    latestKitchenStatus: aggregateKitchenStatus,
    latestKitchenDispatchedAt: latestDispatch?.dispatchedAt.toISOString() ?? null,
  };
}

export class SalesOperationError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'SalesOperationError';
  }
}

const orderDetailSelect = {
  id: true,
  status: true,
  guestCount: true,
  openedAt: true,
  billRequestedAt: true,
  diningTable: {
    select: {
      id: true,
      code: true,
      area: true,
      capacity: true,
      active: true,
    },
  },
  openedBy: {
    select: {
      id: true,
      fullName: true,
    },
  },
  items: {
    orderBy: { id: 'asc' as const },
    select: {
      id: true,
      menuItemId: true,
      menuItemNameSnapshot: true,
      quantity: true,
      specialInstructions: true,
      unitPriceSnapshot: true,
      currencySnapshot: true,
      taxIncludedSnapshot: true,
      parentItemId: true,
      kitchenDispatchItem: {
        select: kitchenDispatchItemStateSelect,
      },
    },
  },
} satisfies Prisma.SalesOrderSelect;

type OrderDetailRecord = Prisma.SalesOrderGetPayload<{
  select: typeof orderDetailSelect;
}>;

type OrderItemRecord = OrderDetailRecord['items'][number];

function money(value: Prisma.Decimal.Value): string {
  return new Prisma.Decimal(value).toFixed(2);
}

function lineSubtotal(item: OrderItemRecord): Prisma.Decimal {
  return new Prisma.Decimal(item.unitPriceSnapshot).mul(item.quantity);
}

function toAdditionDto(item: OrderItemRecord) {
  const kitchenState = item.kitchenDispatchItem;
  return {
    id: item.id,
    menuItemId: item.menuItemId,
    name: item.menuItemNameSnapshot,
    quantity: item.quantity,
    specialInstructions: item.specialInstructions,
    unitPrice: money(item.unitPriceSnapshot),
    currency: item.currencySnapshot,
    taxIncluded: item.taxIncludedSnapshot,
    lineSubtotal: lineSubtotal(item).toFixed(2),
    kitchenDispatched: kitchenState !== null,
    kitchenDispatchId: kitchenState?.kitchenDispatchId ?? null,
    kitchenStatus: kitchenState?.kitchenDispatch.status ?? null,
    kitchenDispatchedAt:
      kitchenState?.kitchenDispatch.dispatchedAt.toISOString() ?? null,
  };
}

export function toSalesOrderDto(order: OrderDetailRecord) {
  const currencies = new Set(order.items.map(item => item.currencySnapshot));
  if (currencies.size > 1) {
    throw new SalesOperationError(
      'ORDER_DATA_INCONSISTENT',
      500,
      'La orden contiene monedas inconsistentes',
    );
  }

  const additionsByParent = new Map<number, OrderItemRecord[]>();
  for (const item of order.items) {
    if (item.parentItemId !== null) {
      const additions = additionsByParent.get(item.parentItemId) ?? [];
      additions.push(item);
      additionsByParent.set(item.parentItemId, additions);
    }
  }

  const subtotal = order.items.reduce(
    (total, item) => total.add(lineSubtotal(item)),
    new Prisma.Decimal(0),
  );
  const currency = currencies.values().next().value ?? null;

  return {
    id: order.id,
    status: order.status,
    table: order.diningTable,
    guestCount: order.guestCount,
    openedAt: order.openedAt.toISOString(),
    billRequestedAt: order.billRequestedAt?.toISOString() ?? null,
    openedBy: order.openedBy,
    ...kitchenSummary(order.items),
    items: order.items
      .filter(item => item.parentItemId === null)
      .map(item => ({
        ...toAdditionDto(item),
        additions: (additionsByParent.get(item.id) ?? []).map(toAdditionDto),
      })),
    totals: {
      subtotal: subtotal.toFixed(2),
      total: subtotal.toFixed(2),
      currency,
    },
  };
}

async function findOrderRecord(client: SalesClient, orderId: number) {
  return client.salesOrder.findUnique({
    where: { id: orderId },
    select: orderDetailSelect,
  });
}

async function requireOrderRecord(client: SalesClient, orderId: number) {
  const order = await findOrderRecord(client, orderId);
  if (!order) {
    throw new SalesOperationError('ORDER_NOT_FOUND', 404, 'Orden no encontrada');
  }
  return order;
}

async function lockOpenOrder(transaction: Prisma.TransactionClient, orderId: number) {
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

type ResolvedCommercialItem = {
  id: number;
  name: string;
  kind: MenuItemKind;
  price: {
    id: number;
    amount: Prisma.Decimal;
    currency: string;
    taxIncluded: boolean;
  };
};

async function resolveCommercialItem(
  transaction: Prisma.TransactionClient,
  menuItemId: number,
  expectedKind: MenuItemKind,
): Promise<ResolvedCommercialItem> {
  const item = await transaction.menuItem.findUnique({
    where: { id: menuItemId },
    select: {
      id: true,
      name: true,
      active: true,
      available: true,
      kind: true,
      category: { select: { active: true } },
      prices: {
        where: currentPublishedMenuItemPriceWhere,
        orderBy: [{ validFrom: 'desc' }, { id: 'desc' }],
        take: 2,
        select: {
          id: true,
          amount: true,
          currency: true,
          taxIncluded: true,
        },
      },
    },
  });

  if (!item) {
    throw new SalesOperationError(
      'MENU_ITEM_NOT_FOUND',
      404,
      'Producto de menú no encontrado',
    );
  }
  if (!item.active || !item.category?.active) {
    throw new SalesOperationError(
      'MENU_ITEM_NOT_SALEABLE',
      409,
      'El producto no está habilitado comercialmente',
    );
  }
  if (!item.available) {
    throw new SalesOperationError(
      'MENU_ITEM_UNAVAILABLE',
      409,
      'El producto está agotado',
    );
  }
  if (item.kind !== expectedKind) {
    const isAddition = expectedKind === MenuItemKind.ADDITION;
    throw new SalesOperationError(
      isAddition ? 'ADDITION_KIND_REQUIRED' : 'MENU_ITEM_NOT_SALEABLE',
      409,
      isAddition
        ? 'El producto seleccionado no es una adición'
        : 'Una adición no puede agregarse como línea principal',
    );
  }
  if (item.prices.length === 0) {
    throw new SalesOperationError(
      'MENU_ITEM_PRICE_NOT_FOUND',
      409,
      'El producto no tiene un precio publicado vigente',
    );
  }
  if (item.prices.length > 1) {
    throw new SalesOperationError(
      'MENU_ITEM_NOT_SALEABLE',
      409,
      'El producto tiene más de un precio publicado vigente',
    );
  }

  return {
    id: item.id,
    name: item.name,
    kind: item.kind,
    price: item.prices[0],
  };
}

async function ensureOrderCurrency(
  transaction: Prisma.TransactionClient,
  orderId: number,
  resolvedItems: readonly ResolvedCommercialItem[],
) {
  const currentLine = await transaction.salesOrderItem.findFirst({
    where: { salesOrderId: orderId },
    orderBy: { id: 'asc' },
    select: { currencySnapshot: true },
  });
  const expectedCurrency = currentLine?.currencySnapshot ?? resolvedItems[0]?.price.currency;

  if (
    expectedCurrency
    && resolvedItems.some(item => item.price.currency !== expectedCurrency)
  ) {
    throw new SalesOperationError(
      'ORDER_CURRENCY_MISMATCH',
      409,
      'La moneda del producto no coincide con la moneda de la orden',
      { currency: expectedCurrency },
    );
  }
}

function createLineData(
  orderId: number,
  item: ResolvedCommercialItem,
  quantity: number,
  specialInstructions: string | null | undefined,
  actorId: number,
  parentItemId?: number,
): Prisma.SalesOrderItemUncheckedCreateInput {
  return {
    salesOrderId: orderId,
    menuItemId: item.id,
    menuItemPriceId: item.price.id,
    menuItemNameSnapshot: item.name,
    quantity,
    specialInstructions: specialInstructions ?? null,
    unitPriceSnapshot: item.price.amount,
    currencySnapshot: item.price.currency,
    taxIncludedSnapshot: item.price.taxIncluded,
    addedById: actorId,
    parentItemId: parentItemId ?? null,
  };
}

async function ensureOrderItemGroupUnsent(
  transaction: Prisma.TransactionClient,
  item: { id: number; parentItemId: number | null },
) {
  const lineIds = item.parentItemId === null
    ? (await transaction.salesOrderItem.findMany({
        where: {
          OR: [
            { id: item.id },
            { parentItemId: item.id },
          ],
        },
        select: { id: true },
      })).map(line => line.id)
    : [item.id];
  const dispatched = await transaction.kitchenDispatchItem.findFirst({
    where: { salesOrderItemId: { in: lineIds } },
    select: { salesOrderItemId: true },
  });
  if (dispatched) {
    throw new SalesOperationError(
      'ORDER_ITEM_ALREADY_SENT_TO_KITCHEN',
      409,
      'La línea ya fue enviada a cocina y no puede modificarse',
      { itemId: dispatched.salesOrderItemId },
    );
  }
}

const salesTableSelect = {
  id: true,
  code: true,
  area: true,
  capacity: true,
  active: true,
  salesOrders: {
    where: { status: SalesOrderStatus.OPEN },
    take: 1,
    select: {
      id: true,
      guestCount: true,
      openedAt: true,
      billRequestedAt: true,
      openedBy: { select: { id: true, fullName: true } },
      items: {
        select: {
          id: true,
          parentItemId: true,
          kitchenDispatchItem: {
            select: kitchenDispatchItemStateSelect,
          },
        },
      },
    },
  },
} satisfies Prisma.DiningTableSelect;

type SalesTableRecord = Prisma.DiningTableGetPayload<{
  select: typeof salesTableSelect;
}>;

function toSalesTableDto({ salesOrders, ...table }: SalesTableRecord) {
  const activeOrder = salesOrders[0] ?? null;
  let activeOrderDto = null;
  if (activeOrder) {
    const { items, ...orderData } = activeOrder;
    activeOrderDto = {
      ...orderData,
      openedAt: activeOrder.openedAt.toISOString(),
      billRequestedAt: activeOrder.billRequestedAt?.toISOString() ?? null,
      ...kitchenSummary(items),
    };
  }

  return {
    ...table,
    operationalStatus: activeOrder
      ? 'OCCUPIED'
      : table.active ? 'AVAILABLE' : 'OUT_OF_SERVICE',
    activeOrder: activeOrderDto,
  };
}

async function getSalesTable(tableId: number, client: SalesClient) {
  const table = await client.diningTable.findUnique({
    where: { id: tableId },
    select: salesTableSelect,
  });
  if (!table) {
    throw new SalesOperationError('TABLE_NOT_FOUND', 404, 'Mesa no encontrada');
  }
  return toSalesTableDto(table);
}

async function lockDiningTable(
  transaction: Prisma.TransactionClient,
  tableId: number,
) {
  const rows = await transaction.$queryRaw<Array<{ id: number }>>`
    SELECT "id"
    FROM "dining_tables"
    WHERE "id" = ${tableId}
    FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new SalesOperationError('TABLE_NOT_FOUND', 404, 'Mesa no encontrada');
  }
}

function translateDiningTableWriteError(error: unknown): never {
  if (error instanceof SalesOperationError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new SalesOperationError(
        'TABLE_CODE_ALREADY_EXISTS',
        409,
        'Ya existe una mesa con ese código',
      );
    }
    if (error.code === 'P2025') {
      throw new SalesOperationError('TABLE_NOT_FOUND', 404, 'Mesa no encontrada');
    }
  }
  throw error;
}

export async function listSalesTables(client: SalesClient = prisma) {
  const tables = await client.diningTable.findMany({
    orderBy: [{ area: 'asc' }, { code: 'asc' }, { id: 'asc' }],
    select: salesTableSelect,
  });

  return tables.map(toSalesTableDto);
}

export async function createSalesTable(input: CreateDiningTableInput) {
  try {
    const table = await prisma.diningTable.create({
      data: input,
      select: { id: true },
    });
    return getSalesTable(table.id, prisma);
  } catch (error) {
    return translateDiningTableWriteError(error);
  }
}

export async function updateSalesTable(
  tableId: number,
  input: UpdateDiningTableInput,
) {
  try {
    return await prisma.$transaction(async transaction => {
      await lockDiningTable(transaction, tableId);
      if (input.active === false) {
        const activeOrder = await transaction.salesOrder.findFirst({
          where: { diningTableId: tableId, status: SalesOrderStatus.OPEN },
          select: { id: true },
        });
        if (activeOrder) {
          throw new SalesOperationError(
            'TABLE_HAS_ACTIVE_ORDER',
            409,
            'No se puede poner fuera de servicio una mesa con un pedido abierto',
            { activeOrderId: activeOrder.id },
          );
        }
      }

      await transaction.diningTable.update({
        where: { id: tableId },
        data: input,
        select: { id: true },
      });
      return getSalesTable(tableId, transaction);
    });
  } catch (error) {
    return translateDiningTableWriteError(error);
  }
}

export async function getSalesOrder(orderId: number, client: SalesClient = prisma) {
  return toSalesOrderDto(await requireOrderRecord(client, orderId));
}

export async function getActiveSalesOrderByTable(
  tableId: number,
  client: SalesClient = prisma,
) {
  const table = await client.diningTable.findUnique({
    where: { id: tableId },
    select: {
      id: true,
      salesOrders: {
        where: { status: SalesOrderStatus.OPEN },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!table) {
    throw new SalesOperationError('TABLE_NOT_FOUND', 404, 'Mesa no encontrada');
  }
  const activeOrder = table.salesOrders[0];
  if (!activeOrder) {
    throw new SalesOperationError(
      'ACTIVE_ORDER_NOT_FOUND',
      404,
      'La mesa no tiene una orden activa',
    );
  }
  return getSalesOrder(activeOrder.id, client);
}

export async function openSalesTable(
  tableId: number,
  guestCount: number | undefined,
  actorId: number,
) {
  try {
    const orderId = await prisma.$transaction(async transaction => {
      await lockDiningTable(transaction, tableId);
      const table = await transaction.diningTable.findUnique({
        where: { id: tableId },
        select: { active: true },
      });
      if (!table?.active) {
        throw new SalesOperationError(
          'TABLE_OUT_OF_SERVICE',
          409,
          'La mesa está fuera de servicio',
        );
      }

      const order = await transaction.salesOrder.create({
        data: {
          diningTableId: tableId,
          openedById: actorId,
          guestCount,
        },
        select: { id: true },
      });
      return order.id;
    });
    return getSalesOrder(orderId);
  } catch (error) {
    if (error instanceof SalesOperationError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const activeOrder = await prisma.salesOrder.findFirst({
        where: { diningTableId: tableId, status: SalesOrderStatus.OPEN },
        select: { id: true },
      });
      if (activeOrder) {
        throw new SalesOperationError(
          'TABLE_ALREADY_OCCUPIED',
          409,
          'La mesa ya tiene una orden activa',
          { activeOrderId: activeOrder.id },
        );
      }
    }
    throw error;
  }
}

export async function addSalesOrderItem(
  orderId: number,
  input: AddOrderItemInput,
  actorId: number,
) {
  return prisma.$transaction(async transaction => {
    await lockOpenOrder(transaction, orderId);
    const principal = await resolveCommercialItem(
      transaction,
      input.menuItemId,
      MenuItemKind.STANDARD,
    );
    const additions = await Promise.all((input.additions ?? []).map(async addition => ({
      input: addition,
      item: await resolveCommercialItem(
        transaction,
        addition.menuItemId,
        MenuItemKind.ADDITION,
      ),
    })));
    await ensureOrderCurrency(
      transaction,
      orderId,
      [principal, ...additions.map(addition => addition.item)],
    );

    const principalLine = await transaction.salesOrderItem.create({
      data: createLineData(
        orderId,
        principal,
        input.quantity,
        input.specialInstructions,
        actorId,
      ),
      select: { id: true },
    });
    if (additions.length > 0) {
      await transaction.salesOrderItem.createMany({
        data: additions.map(addition => createLineData(
          orderId,
          addition.item,
          addition.input.quantity ?? input.quantity,
          addition.input.specialInstructions,
          actorId,
          principalLine.id,
        )),
      });
    }

    return getSalesOrder(orderId, transaction);
  });
}

export async function addSalesOrderItemAddition(
  orderId: number,
  itemId: number,
  input: AddExistingOrderItemAdditionInput,
  actorId: number,
) {
  return prisma.$transaction(async transaction => {
    await lockOpenOrder(transaction, orderId);
    const parent = await transaction.salesOrderItem.findFirst({
      where: { id: itemId, salesOrderId: orderId },
      select: { id: true, quantity: true, parentItemId: true },
    });
    if (!parent) {
      throw new SalesOperationError(
        'ORDER_ITEM_NOT_FOUND',
        404,
        'Línea de orden no encontrada',
      );
    }
    if (parent.parentItemId !== null) {
      throw new SalesOperationError(
        'NESTED_ADDITION_NOT_ALLOWED',
        409,
        'No se pueden agregar adiciones a otra adición',
      );
    }
    await ensureOrderItemGroupUnsent(transaction, parent);

    const addition = await resolveCommercialItem(
      transaction,
      input.menuItemId,
      MenuItemKind.ADDITION,
    );
    await ensureOrderCurrency(transaction, orderId, [addition]);
    await transaction.salesOrderItem.create({
      data: createLineData(
        orderId,
        addition,
        input.quantity ?? parent.quantity,
        input.specialInstructions,
        actorId,
        parent.id,
      ),
    });

    return getSalesOrder(orderId, transaction);
  });
}

export async function updateSalesOrderItem(
  orderId: number,
  itemId: number,
  input: UpdateOrderItemInput,
) {
  return prisma.$transaction(async transaction => {
    await lockOpenOrder(transaction, orderId);
    const item = await transaction.salesOrderItem.findFirst({
      where: { id: itemId, salesOrderId: orderId },
      select: { id: true, parentItemId: true },
    });
    if (!item) {
      throw new SalesOperationError(
        'ORDER_ITEM_NOT_FOUND',
        404,
        'Línea de orden no encontrada',
      );
    }
    await ensureOrderItemGroupUnsent(transaction, item);
    await transaction.salesOrderItem.update({
      where: { id: item.id },
      data: {
        ...(input.quantity !== undefined && { quantity: input.quantity }),
        ...(input.specialInstructions !== undefined && {
          specialInstructions: input.specialInstructions,
        }),
      },
    });
    return getSalesOrder(orderId, transaction);
  });
}

export async function deleteSalesOrderItem(orderId: number, itemId: number) {
  return prisma.$transaction(async transaction => {
    await lockOpenOrder(transaction, orderId);
    const item = await transaction.salesOrderItem.findFirst({
      where: { id: itemId, salesOrderId: orderId },
      select: { id: true, parentItemId: true },
    });
    if (!item) {
      throw new SalesOperationError(
        'ORDER_ITEM_NOT_FOUND',
        404,
        'Línea de orden no encontrada',
      );
    }
    await ensureOrderItemGroupUnsent(transaction, item);
    if (item.parentItemId === null) {
      await transaction.salesOrderItem.deleteMany({ where: { parentItemId: item.id } });
    }
    await transaction.salesOrderItem.delete({ where: { id: item.id } });
    return getSalesOrder(orderId, transaction);
  });
}

export async function updateSalesOrderGuestCount(
  orderId: number,
  guestCount: number | null,
) {
  return prisma.$transaction(async transaction => {
    await lockOpenOrder(transaction, orderId);
    await transaction.salesOrder.update({
      where: { id: orderId },
      data: { guestCount },
    });
    return getSalesOrder(orderId, transaction);
  });
}

export async function requestSalesOrderBill(orderId: number) {
  return prisma.$transaction(async transaction => {
    await lockOpenOrder(transaction, orderId);
    const order = await transaction.salesOrder.findUnique({
      where: { id: orderId },
      select: { billRequestedAt: true },
    });
    if (order?.billRequestedAt === null) {
      await transaction.salesOrder.update({
        where: { id: orderId },
        data: { billRequestedAt: new Date() },
      });
    }
    return getSalesOrder(orderId, transaction);
  });
}
