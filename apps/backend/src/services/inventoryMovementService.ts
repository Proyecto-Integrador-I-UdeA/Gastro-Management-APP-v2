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
  /** Obligatorio para PURCHASE; ignorado en otros tipos */
  unitCost?: number | null;
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
      if (unitCost == null || Number.isNaN(unitCost) || unitCost < 0) {
        throw new KardexError('Costo unitario inválido para COMPRA');
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          type,
          quantity,
          unitCost: new Prisma.Decimal(unitCost),
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

      const movement = await tx.inventoryMovement.create({
        data: {
          type,
          quantity,
          unitCost: null,
          expirationDate: expirationDate ?? null,
          notes: notes ?? null,
          productId,
          sourceWarehouseId,
          destinationWarehouseId,
          userId,
        },
      });

      await applyTransferStockOnly(
        tx,
        productId,
        quantity,
        sourceWarehouseId,
        destinationWarehouseId
      );

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
          unitCost: null,
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

/**
 * Revierte el efecto en inventario de un TRASLADO ya registrado (destino -q, origen +q).
 */
export async function reverseTransferInventory(
  tx: Prisma.TransactionClient,
  productId: number,
  quantity: number,
  sourceWarehouseId: number,
  destinationWarehouseId: number
) {
  const destRow = await tx.inventory.findUnique({
    where: {
      productId_warehouseId: {
        productId,
        warehouseId: destinationWarehouseId,
      },
    },
  });
  if (!destRow || destRow.quantity < quantity) {
    throw new KardexError(
      'No se puede revertir: stock insuficiente en bodega destino'
    );
  }

  await tx.inventory.update({
    where: {
      productId_warehouseId: {
        productId,
        warehouseId: destinationWarehouseId,
      },
    },
    data: { quantity: { decrement: quantity } },
  });

  await tx.inventory.upsert({
    where: {
      productId_warehouseId: {
        productId,
        warehouseId: sourceWarehouseId,
      },
    },
    create: {
      productId,
      warehouseId: sourceWarehouseId,
      quantity,
    },
    update: { quantity: { increment: quantity } },
  });
}

/**
 * Revierte una COMPRA: descuenta cantidad en bodega destino.
 */
export async function reversePurchaseInventory(
  tx: Prisma.TransactionClient,
  productId: number,
  quantity: number,
  destinationWarehouseId: number
) {
  const destRow = await tx.inventory.findUnique({
    where: {
      productId_warehouseId: {
        productId,
        warehouseId: destinationWarehouseId,
      },
    },
  });
  if (!destRow || destRow.quantity < quantity) {
    throw new KardexError(
      'No se puede revertir: stock insuficiente en bodega destino'
    );
  }

  await tx.inventory.update({
    where: {
      productId_warehouseId: {
        productId,
        warehouseId: destinationWarehouseId,
      },
    },
    data: { quantity: { decrement: quantity } },
  });
}

async function applyTransferStockOnly(
  tx: Prisma.TransactionClient,
  productId: number,
  quantity: number,
  sourceWarehouseId: number,
  destinationWarehouseId: number
) {
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
    update: { quantity: { increment: quantity } },
  });
}

/**
 * Edita traslado (cantidad revierte stock) o entrada por compra (solo notas; vencimiento no se modifica).
 */
export async function updateTransferMovementInTransaction(
  tx: Prisma.TransactionClient,
  movementId: number,
  updates: {
    quantity?: number;
    notes?: string | null;
  }
) {
  const mov = await tx.inventoryMovement.findUnique({ where: { id: movementId } });
  if (!mov) {
    throw new KardexError('Movimiento no encontrado', 404);
  }

  if (mov.type === MovementType.PURCHASE) {
    if (updates.quantity !== undefined) {
      throw new KardexError(
        'La cantidad de una entrada por compra no se puede modificar desde aquí',
        400
      );
    }
    const data: { notes?: string | null } = {};
    if (updates.notes !== undefined) data.notes = updates.notes;
    if (Object.keys(data).length === 0) {
      return mov;
    }
    return tx.inventoryMovement.update({
      where: { id: movementId },
      data,
    });
  }

  if (mov.type !== MovementType.TRANSFER) {
    throw new KardexError('Este tipo de movimiento no se puede editar', 400);
  }

  const src = mov.sourceWarehouseId;
  const dst = mov.destinationWarehouseId;
  if (src == null || dst == null) {
    throw new KardexError('Traslado inválido', 400);
  }

  if (updates.quantity === undefined) {
    const data: { notes?: string | null } = {};
    if (updates.notes !== undefined) data.notes = updates.notes;
    if (Object.keys(data).length === 0) {
      return mov;
    }
    return tx.inventoryMovement.update({
      where: { id: movementId },
      data,
    });
  }

  const q1 = mov.quantity;
  const q2 = updates.quantity;
  if (q2 <= 0) {
    throw new KardexError('La cantidad debe ser mayor a cero');
  }

  await reverseTransferInventory(tx, mov.productId, q1, src, dst);
  await applyTransferStockOnly(tx, mov.productId, q2, src, dst);

  const data: Prisma.InventoryMovementUpdateInput = { quantity: q2 };
  if (updates.notes !== undefined) data.notes = updates.notes;

  return tx.inventoryMovement.update({
    where: { id: movementId },
    data,
  });
}
