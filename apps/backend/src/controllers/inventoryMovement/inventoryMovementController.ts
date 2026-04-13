import { Request, Response } from 'express';
import { MovementType, Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import {
  createInventoryMovementSchema,
  patchTransferMovementSchema,
} from '../../schemas/inventoryMovementSchema';
import {
  applyInventoryMovement,
  KardexError,
  reversePurchaseInventory,
  reverseTransferInventory,
  updateTransferMovementInTransaction,
} from '../../services/inventoryMovementService';

interface AuthRequest extends Request {
  user?: { id: number; email: string; role: string; permissions?: string[] };
}

const movementInclude = {
  product: { include: { supplier: true } },
  sourceWarehouse: true,
  destinationWarehouse: true,
  user: {
    select: { id: true, email: true, fullName: true },
  },
} as const;

export const listInventoryMovements = async (req: Request, res: Response) => {
  try {
    const typesParam = req.query.types as string | undefined;
    const typeParam = req.query.type as string | undefined;
    const productIdParam = req.query.productId
      ? parseInt(String(req.query.productId), 10)
      : undefined;
    const warehouseIdParam = req.query.warehouseId
      ? parseInt(String(req.query.warehouseId), 10)
      : undefined;
    const skip = req.query.skip ? parseInt(String(req.query.skip), 10) : 0;
    const take = Math.min(
      req.query.take ? parseInt(String(req.query.take), 10) : 50,
      200
    );

    const where: Prisma.InventoryMovementWhereInput = {};

    if (typesParam && typesParam.trim() !== '') {
      const parts = typesParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const valid = parts.filter((p): p is MovementType =>
        Object.values(MovementType).includes(p as MovementType)
      );
      if (valid.length === 1) {
        where.type = valid[0];
      } else if (valid.length > 1) {
        where.type = { in: valid };
      }
    } else if (typeParam && Object.values(MovementType).includes(typeParam as MovementType)) {
      where.type = typeParam as MovementType;
    }
    if (productIdParam != null && !Number.isNaN(productIdParam)) {
      where.productId = productIdParam;
    }
    if (warehouseIdParam != null && !Number.isNaN(warehouseIdParam)) {
      where.OR = [
        { sourceWarehouseId: warehouseIdParam },
        { destinationWarehouseId: warehouseIdParam },
      ];
    }

    const [items, total] = await prisma.$transaction([
      prisma.inventoryMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: Number.isNaN(skip) ? 0 : Math.max(0, skip),
        take: Number.isNaN(take) ? 50 : take,
        include: movementInclude,
      }),
      prisma.inventoryMovement.count({ where }),
    ]);

    res.json({ items, total });
  } catch (error) {
    console.error('Error al listar movimientos:', error);
    res.status(500).json({ error: 'Error interno al listar movimientos' });
  }
};

export const getInventoryMovementById = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  try {
    const row = await prisma.inventoryMovement.findUnique({
      where: { id },
      include: movementInclude,
    });
    if (!row) {
      return res.status(404).json({ error: 'Movimiento no encontrado' });
    }
    res.json(row);
  } catch (error) {
    console.error('Error al obtener movimiento:', error);
    res.status(500).json({ error: 'Error interno' });
  }
};

export const createInventoryMovement = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const validation = createInventoryMovementSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: validation.error.flatten().fieldErrors,
    });
  }

  const data = validation.data;

  const product = await prisma.product.findUnique({ where: { id: data.productId } });
  if (!product) {
    return res.status(400).json({ error: 'Producto no encontrado' });
  }
  if (!product.active) {
    return res.status(400).json({ error: 'El producto está inactivo' });
  }

  const warehouseIds = new Set<number>();
  if (data.sourceWarehouseId != null) warehouseIds.add(data.sourceWarehouseId);
  if (data.destinationWarehouseId != null) warehouseIds.add(data.destinationWarehouseId);
  if (warehouseIds.size > 0) {
    const warehouses = await prisma.warehouse.findMany({
      where: { id: { in: [...warehouseIds] } },
    });
    if (warehouses.length !== warehouseIds.size) {
      return res.status(400).json({ error: 'Una o más bodegas no existen' });
    }
    const inactive = warehouses.filter((w) => !w.active);
    if (inactive.length > 0) {
      return res.status(400).json({ error: 'No se puede operar sobre bodegas inactivas' });
    }
  }

  let expirationDate: Date | null = null;
  if (data.type === MovementType.PURCHASE) {
    if (data.expirationDate != null && data.expirationDate !== '') {
      const d = new Date(data.expirationDate);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ error: 'expirationDate inválida' });
      }
      expirationDate = d;
    }
  }

  try {
    const movement = await prisma.$transaction(async (tx) =>
      applyInventoryMovement(
        tx,
        data.type,
        {
          productId: data.productId,
          quantity: data.quantity,
          unitCost:
            data.type === MovementType.PURCHASE ? (data.unitCost ?? null) : null,
          expirationDate,
          notes: data.notes ?? null,
          sourceWarehouseId: data.sourceWarehouseId ?? null,
          destinationWarehouseId: data.destinationWarehouseId ?? null,
        },
        userId
      )
    );

    const full = await prisma.inventoryMovement.findUnique({
      where: { id: movement.id },
      include: movementInclude,
    });

    res.status(201).json(full);
  } catch (e: unknown) {
    if (e instanceof KardexError) {
      return res.status(e.statusCode).json({ error: e.message });
    }
    const err = e as { code?: string };
    if (err.code === 'P2003') {
      return res.status(400).json({ error: 'Referencia inválida (producto, bodega o usuario)' });
    }
    console.error('Error al crear movimiento de inventario:', e);
    res.status(500).json({ error: 'Error interno al registrar movimiento' });
  }
};

export const patchTransferMovement = async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  const validation = patchTransferMovementSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: validation.error.flatten().fieldErrors,
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await updateTransferMovementInTransaction(tx, id, validation.data);
    });

    const full = await prisma.inventoryMovement.findUnique({
      where: { id },
      include: movementInclude,
    });
    res.json(full);
  } catch (e: unknown) {
    if (e instanceof KardexError) {
      return res.status(e.statusCode).json({ error: e.message });
    }
    console.error('Error al actualizar traslado:', e);
    res.status(500).json({ error: 'Error interno al actualizar traslado' });
  }
};

export const deleteTransferMovement = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const mov = await tx.inventoryMovement.findUnique({ where: { id } });
      if (!mov) {
        throw new KardexError('Movimiento no encontrado', 404);
      }
      if (mov.type === MovementType.TRANSFER) {
        const src = mov.sourceWarehouseId;
        const dst = mov.destinationWarehouseId;
        if (src == null || dst == null) {
          throw new KardexError('Traslado inválido', 400);
        }
        await reverseTransferInventory(tx, mov.productId, mov.quantity, src, dst);
      } else if (mov.type === MovementType.PURCHASE) {
        const dst = mov.destinationWarehouseId;
        if (dst == null) {
          throw new KardexError('Entrada por compra inválida', 400);
        }
        await reversePurchaseInventory(
          tx,
          mov.productId,
          mov.quantity,
          dst
        );
      } else {
        throw new KardexError(
          'Solo se pueden eliminar traslados o entradas por compra',
          400
        );
      }
      await tx.inventoryMovement.delete({ where: { id } });
    });
    res.status(204).send();
  } catch (e: unknown) {
    if (e instanceof KardexError) {
      return res.status(e.statusCode).json({ error: e.message });
    }
    console.error('Error al eliminar traslado:', e);
    res.status(500).json({ error: 'Error interno al eliminar traslado' });
  }
};
