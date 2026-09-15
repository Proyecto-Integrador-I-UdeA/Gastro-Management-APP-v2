import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { createWarehouseSchema, updateWarehouseSchema } from '../../schemas/warehouseSchema';

const operationalUseLabels = {
  purchaseReceiving: 'Recepción de compras',
  kitchenConsumption: 'Consumo de Cocina',
  barConsumption: 'Consumo de Bar',
} as const;

type OperationalUse = keyof typeof operationalUseLabels;

class WarehouseOperationalUseConflict extends Error {
  constructor(
    readonly operationalUse: OperationalUse,
    readonly warehouseId: number,
    readonly warehouseName: string,
  ) {
    super(`El uso ${operationalUseLabels[operationalUse]} ya está asignado a la bodega activa "${warehouseName}"`);
  }
}

class WarehouseNotFound extends Error {}

async function ensureOperationalUsesAvailable(
  tx: Prisma.TransactionClient,
  warehouseId: number | null,
  active: boolean,
  uses: Record<OperationalUse, boolean>,
) {
  if (!active) return;
  const selected = (Object.keys(operationalUseLabels) as OperationalUse[])
    .filter(use => uses[use]);
  if (selected.length === 0) return;
  const conflicts = await tx.warehouse.findMany({
    where: {
      active: true,
      ...(warehouseId !== null && { id: { not: warehouseId } }),
      OR: selected.map(use => ({ [use]: true })),
    },
    select: {
      id: true,
      name: true,
      purchaseReceiving: true,
      kitchenConsumption: true,
      barConsumption: true,
    },
  });
  for (const use of selected) {
    const conflict = conflicts.find(warehouse => warehouse[use]);
    if (conflict) throw new WarehouseOperationalUseConflict(use, conflict.id, conflict.name);
  }
}

function operationalConflictResponse(error: WarehouseOperationalUseConflict, res: Response) {
  return res.status(409).json({
    code: 'WAREHOUSE_OPERATIONAL_USE_CONFLICT',
    error: error.message,
    operationalUse: error.operationalUse,
    conflictingWarehouseId: error.warehouseId,
  });
}

function isOperationalUniqueViolation(error: unknown) {
  const candidate = error as { code?: string; message?: string; meta?: unknown };
  if (candidate.code !== 'P2002') return false;
  const detail = `${candidate.message ?? ''} ${JSON.stringify(candidate.meta ?? {})}`;
  return detail.includes('warehouses_one_active_')
    || detail.includes('purchaseReceiving')
    || detail.includes('kitchenConsumption')
    || detail.includes('barConsumption');
}

export const listWarehouse = async (req: Request, res: Response) => {
  try {
    const activeOnly = req.query.active === 'true';
    const warehouse = await prisma.warehouse.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { name: 'asc' },
    });
    res.json(warehouse);
  } catch (error) {
    console.error('Error al listar bodegas:', error);
    res.status(500).json({ error: 'Error interno al listar bodegas' });
  }
};

export const getWarehouseById = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  try {
    const warehouse = await prisma.warehouse.findUnique({ where: { id } });
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    res.json(warehouse);
  } catch (error) {
    console.error('Error al obtener bodega:', error);
    res.status(500).json({ error: 'Error interno' });
  }
};

export const createWarehouse = async (req: Request, res: Response) => {
  const validation = createWarehouseSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: validation.error.flatten().fieldErrors,
    });
  }
  const data = validation.data;
  try {
    const warehouse = await prisma.$transaction(async (tx) => {
      await ensureOperationalUsesAvailable(tx, null, data.active ?? true, {
        purchaseReceiving: data.purchaseReceiving ?? false,
        kitchenConsumption: data.kitchenConsumption ?? false,
        barConsumption: data.barConsumption ?? false,
      });
      if (data.isMain) {
        await tx.warehouse.updateMany({ data: { isMain: false } });
      }
      return tx.warehouse.create({
        data: {
          name: data.name,
          description: data.description ?? null,
          active: data.active ?? true,
          isMain: data.isMain ?? false,
          purchaseReceiving: data.purchaseReceiving ?? false,
          kitchenConsumption: data.kitchenConsumption ?? false,
          barConsumption: data.barConsumption ?? false,
        },
      });
    });
    res.status(201).json(warehouse);
  } catch (error: unknown) {
    if (error instanceof WarehouseOperationalUseConflict) {
      return operationalConflictResponse(error, res);
    }
    if (isOperationalUniqueViolation(error)) {
      return res.status(409).json({
        code: 'WAREHOUSE_OPERATIONAL_USE_CONFLICT',
        error: 'Otro cambio asignó este uso operativo a una bodega activa. Recargue e inténtelo nuevamente.',
      });
    }
    const err = error as { code?: string };
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe una bodega con ese nombre' });
    }
    console.error('Error al crear bodega:', error);
    res.status(500).json({ error: 'Error interno al crear bodega' });
  }
};

export const updateWarehouse = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  const validation = updateWarehouseSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: validation.error.flatten().fieldErrors,
    });
  }
  const data = validation.data;
  try {
    const warehouse = await prisma.$transaction(async (tx) => {
      const current = await tx.warehouse.findUnique({ where: { id } });
      if (!current) {
        throw new WarehouseNotFound('Warehouse not found');
      }
      await ensureOperationalUsesAvailable(tx, id, data.active ?? current.active, {
        purchaseReceiving: data.purchaseReceiving ?? current.purchaseReceiving,
        kitchenConsumption: data.kitchenConsumption ?? current.kitchenConsumption,
        barConsumption: data.barConsumption ?? current.barConsumption,
      });
      if (data.isMain === true) {
        await tx.warehouse.updateMany({ where: { id: { not: id } }, data: { isMain: false } });
      }
      return tx.warehouse.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.active !== undefined && { active: data.active }),
          ...(data.isMain !== undefined && { isMain: data.isMain }),
          ...(data.purchaseReceiving !== undefined && { purchaseReceiving: data.purchaseReceiving }),
          ...(data.kitchenConsumption !== undefined && { kitchenConsumption: data.kitchenConsumption }),
          ...(data.barConsumption !== undefined && { barConsumption: data.barConsumption }),
        },
      });
    });
    res.json(warehouse);
  } catch (error: unknown) {
    if (error instanceof WarehouseNotFound) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    if (error instanceof WarehouseOperationalUseConflict) {
      return operationalConflictResponse(error, res);
    }
    if (isOperationalUniqueViolation(error)) {
      return res.status(409).json({
        code: 'WAREHOUSE_OPERATIONAL_USE_CONFLICT',
        error: 'Otro cambio asignó este uso operativo a una bodega activa. Recargue e inténtelo nuevamente.',
      });
    }
    const err = error as { code?: string };
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe una bodega con ese nombre' });
    }
    console.error('Error al actualizar bodega:', error);
    res.status(500).json({ error: 'Error interno al actualizar bodega' });
  }
};
