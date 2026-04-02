import { MovementType, Prisma } from '@prisma/client';

export class KardexError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'KardexError';
    this.statusCode = statusCode;
  }
}

export type MovementPayload = {
  productId: number;
  quantity: number;
  unitCost?: Prisma.Decimal | null;
  expirationDate?: Date | null;
  notes?: string | null;
  sourceWarehouseId?: number | null;
  destinationWarehouseId?: number | null;
};

/**
 * Crea el movimiento y aplica el impacto en inventario / producto.
 * Debe ejecutarse siempre dentro de prisma.$transaction.
 */
export async function applyInventoryMovement(
  tx: Prisma.TransactionClient,
  type: MovementType,
  payload: MovementPayload,
  userId: number
) {
  const {
    productId,
    quantity,
    unitCost,
    expirationDate,
    notes,
    sourceWarehouseId,
    destinationWarehouseId,
  } = payload;

  if (quantity <= 0) {
    throw new KardexError('La cantidad debe ser mayor a cero');
  }

  switch (type) {
    case MovementType.PURCHASE: {
      if (!destinationWarehouseId) {
        throw new KardexError('destinationWarehouseId es requerido para COMPRA');
      }
      if (sourceWarehouseId != null) {
        throw new KardexError('sourceWarehouseId no aplica para COMPRA');
      }
      if (unitCost == null) {
        throw new KardexError('unitCost es requerido para COMPRA');
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          type,
          quantity,
          unitCost,
          expirationDate: expirationDate ?? null,
          notes: notes ?? null,
          productId,
          sourceWarehouseId: null,
          destinationWarehouseId,
          userId,
        },
      });

      await tx.inventory.upsert({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId: destinationWarehouseId,
          },
        },
        create: {
          productId,
          warehouseId: destinationWarehouseId,
          quantity,
        },
        update: {
          quantity: { increment: quantity },
        },
      });

      await tx.product.update({
        where: { id: productId },
        data: { unitCost },
      });

      return movement;
    }

    case MovementType.TRANSFER: {
      if (!sourceWarehouseId || !destinationWarehouseId) {
        throw new KardexError(
          'sourceWarehouseId y destinationWarehouseId son requeridos para TRASLADO'
        );
      }
      if (sourceWarehouseId === destinationWarehouseId) {
        throw new KardexError('Bodega origen y destino deben ser distintas');
      }

      const sourceRow = await tx.inventory.findUnique({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId: sourceWarehouseId,
          },
        },
      });
      if (!sourceRow || sourceRow.quantity < quantity) {
        throw new KardexError('Stock insuficiente en bodega origen');
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          type,
          quantity,
          unitCost: unitCost ?? null,
          expirationDate: expirationDate ?? null,
          notes: notes ?? null,
          productId,
          sourceWarehouseId,
          destinationWarehouseId,
          userId,
        },
      });

      await tx.inventory.update({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId: sourceWarehouseId,
          },
        },
        data: { quantity: { decrement: quantity } },
      });

      await tx.inventory.upsert({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId: destinationWarehouseId,
          },
        },
        create: {
          productId,
          warehouseId: destinationWarehouseId,
          quantity,
        },
        update: {
          quantity: { increment: quantity },
        },
      });

      return movement;
    }

    case MovementType.WASTE:
    case MovementType.CONSUMPTION: {
      if (!sourceWarehouseId) {
        throw new KardexError('sourceWarehouseId es requerido para salida de inventario');
      }
      if (destinationWarehouseId != null) {
        throw new KardexError('destinationWarehouseId no aplica para MERMA o CONSUMO');
      }

      const sourceRow = await tx.inventory.findUnique({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId: sourceWarehouseId,
          },
        },
      });
      if (!sourceRow || sourceRow.quantity < quantity) {
        throw new KardexError('Stock insuficiente; no se permiten saldos negativos');
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          type,
          quantity,
          unitCost: unitCost ?? null,
          expirationDate: expirationDate ?? null,
          notes: notes ?? null,
          productId,
          sourceWarehouseId,
          destinationWarehouseId: null,
          userId,
        },
      });

      await tx.inventory.update({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId: sourceWarehouseId,
          },
        },
        data: { quantity: { decrement: quantity } },
      });

      return movement;
    }

    default:
      throw new KardexError(`Tipo de movimiento no soportado: ${String(type)}`);
  }
}
