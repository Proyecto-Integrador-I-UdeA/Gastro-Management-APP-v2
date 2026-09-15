import {
  InventoryPhysicalCountStatus,
  MovementType,
  Prisma,
} from '@prisma/client';
import prisma from '../lib/prisma';
import { costPerBaseUnit } from './pricing/productUnitCost';
import { InvalidCostComponentError } from './pricing/pricingErrors';
import { applyInventoryMovement } from './inventoryMovementService';
import type { PhysicalCountWriteInput } from '../schemas/inventoryPhysicalCountSchema';

export class PhysicalCountError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'PhysicalCountError';
  }
}

const countInclude = {
  warehouse: { select: { id: true, name: true, active: true, isMain: true } },
  createdBy: { select: { id: true, fullName: true, email: true } },
  updatedBy: { select: { id: true, fullName: true, email: true } },
  postedBy: { select: { id: true, fullName: true, email: true } },
  cancelledBy: { select: { id: true, fullName: true, email: true } },
  items: {
    orderBy: { id: 'asc' as const },
    include: {
      product: { select: { id: true, internalCode: true, name: true, unitOfMeasure: true } },
      inventoryMovement: { select: { id: true, quantity: true, createdAt: true } },
    },
  },
};

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function uniqueProductIds(items: PhysicalCountWriteInput['items']) {
  const ids = items.map(item => item.productId);
  if (new Set(ids).size !== ids.length) {
    throw new PhysicalCountError('INVENTORY_PHYSICAL_COUNT_DUPLICATE_PRODUCT', 400, 'Cada producto puede aparecer una sola vez');
  }
  return ids;
}

function productUnitCost(product: {
  inputUnit: string;
  inputUnitQuantity: number;
  unitCost: number;
  unitOfMeasure: string;
}) {
  try {
    return costPerBaseUnit(product);
  } catch (error) {
    if (error instanceof InvalidCostComponentError) {
      throw new PhysicalCountError('INVENTORY_PHYSICAL_COUNT_INVALID_PRODUCT_COST', 422, error.message);
    }
    throw error;
  }
}

async function assertActiveWarehouse(tx: Prisma.TransactionClient, warehouseId: number) {
  const warehouse = await tx.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) throw new PhysicalCountError('WAREHOUSE_NOT_FOUND', 404, 'Bodega no encontrada');
  if (!warehouse.active) throw new PhysicalCountError('WAREHOUSE_INACTIVE', 409, 'La bodega debe estar activa');
}

async function buildNewItems(
  tx: Prisma.TransactionClient,
  warehouseId: number,
  items: PhysicalCountWriteInput['items'],
  existing = new Map<number, { systemQuantitySnapshot: number; unit: string; unitCostSnapshot: Prisma.Decimal }>(),
) {
  const productIds = uniqueProductIds(items);
  const products = await tx.product.findMany({
    where: { id: { in: productIds }, active: true },
    select: { id: true, inputUnit: true, inputUnitQuantity: true, unitCost: true, unitOfMeasure: true },
  });
  if (products.length !== productIds.length) {
    throw new PhysicalCountError('INVENTORY_PHYSICAL_COUNT_PRODUCT_INVALID', 400, 'Uno o más productos no existen o están inactivos');
  }
  const productMap = new Map(products.map(product => [product.id, product]));
  const balances = await tx.inventory.findMany({
    where: { warehouseId, productId: { in: productIds } },
    select: { productId: true, quantity: true },
  });
  const balanceMap = new Map(balances.map(balance => [balance.productId, balance.quantity]));
  return items.map(item => {
    const product = productMap.get(item.productId)!;
    const saved = existing.get(item.productId);
    return {
      productId: item.productId,
      countedQuantity: item.countedQuantity,
      systemQuantitySnapshot: saved?.systemQuantitySnapshot ?? balanceMap.get(item.productId) ?? 0,
      unit: (saved?.unit ?? product.unitOfMeasure) as 'g' | 'ml' | 'und',
      unitCostSnapshot: saved?.unitCostSnapshot ?? productUnitCost(product),
    };
  });
}

export async function listPhysicalCounts(where: { warehouseId?: number; status?: InventoryPhysicalCountStatus }) {
  return serialize(await prisma.inventoryPhysicalCount.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: countInclude,
  }));
}

export async function getPhysicalCount(id: number, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const count = await tx.inventoryPhysicalCount.findUnique({ where: { id }, include: countInclude });
  if (!count) throw new PhysicalCountError('INVENTORY_PHYSICAL_COUNT_NOT_FOUND', 404, 'Conteo físico no encontrado');
  return serialize(count);
}

export async function createPhysicalCount(input: PhysicalCountWriteInput, userId: number) {
  return prisma.$transaction(async tx => {
    await assertActiveWarehouse(tx, input.warehouseId);
    const items = await buildNewItems(tx, input.warehouseId, input.items);
    const count = await tx.inventoryPhysicalCount.create({
      data: {
        warehouseId: input.warehouseId,
        reason: input.reason,
        notes: input.notes || null,
        createdById: userId,
        updatedById: userId,
        items: { create: items },
      },
      select: { id: true },
    });
    return getPhysicalCount(count.id, tx);
  });
}

export async function updatePhysicalCount(id: number, input: Omit<Partial<PhysicalCountWriteInput>, 'warehouseId'>, userId: number) {
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<{ id: number; warehouseId: number; status: InventoryPhysicalCountStatus }>>`
      SELECT "id", "warehouseId", "status" FROM "inventory_physical_counts" WHERE "id" = ${id} FOR UPDATE
    `;
    if (!rows[0]) throw new PhysicalCountError('INVENTORY_PHYSICAL_COUNT_NOT_FOUND', 404, 'Conteo físico no encontrado');
    if (rows[0].status !== InventoryPhysicalCountStatus.DRAFT) {
      throw new PhysicalCountError('INVENTORY_PHYSICAL_COUNT_NOT_DRAFT', 409, 'Solo se puede editar un conteo en borrador');
    }
    if (input.items) {
      const saved = await tx.inventoryPhysicalCountItem.findMany({ where: { physicalCountId: id } });
      const savedMap = new Map(saved.map(item => [item.productId, item]));
      const items = await buildNewItems(tx, rows[0].warehouseId, input.items, savedMap);
      await tx.inventoryPhysicalCountItem.deleteMany({ where: { physicalCountId: id } });
      await tx.inventoryPhysicalCountItem.createMany({ data: items.map(item => ({ ...item, physicalCountId: id })) });
    }
    await tx.inventoryPhysicalCount.update({
      where: { id },
      data: {
        ...(input.reason !== undefined && { reason: input.reason }),
        ...(input.notes !== undefined && { notes: input.notes || null }),
        updatedById: userId,
      },
    });
    return getPhysicalCount(id, tx);
  });
}

export async function refreshPhysicalCount(id: number, userId: number) {
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<{ id: number; warehouseId: number; status: InventoryPhysicalCountStatus }>>`
      SELECT "id", "warehouseId", "status" FROM "inventory_physical_counts" WHERE "id" = ${id} FOR UPDATE
    `;
    if (!rows[0]) throw new PhysicalCountError('INVENTORY_PHYSICAL_COUNT_NOT_FOUND', 404, 'Conteo físico no encontrado');
    if (rows[0].status !== InventoryPhysicalCountStatus.DRAFT) throw new PhysicalCountError('INVENTORY_PHYSICAL_COUNT_NOT_DRAFT', 409, 'Solo se puede actualizar un borrador');
    const items = await tx.inventoryPhysicalCountItem.findMany({ where: { physicalCountId: id } });
    for (const item of items) {
      const balance = await tx.inventory.findUnique({ where: { productId_warehouseId: { productId: item.productId, warehouseId: rows[0].warehouseId } } });
      await tx.inventoryPhysicalCountItem.update({
        where: { id: item.id },
        data: { systemQuantitySnapshot: balance?.quantity ?? 0, countedQuantity: null },
      });
    }
    await tx.inventoryPhysicalCount.update({ where: { id }, data: { updatedById: userId } });
    return getPhysicalCount(id, tx);
  });
}

export async function postPhysicalCount(id: number, userId: number) {
  return prisma.$transaction(async tx => {
    const docs = await tx.$queryRaw<Array<{ status: InventoryPhysicalCountStatus; warehouseId: number; reason: string }>>`
      SELECT "status", "warehouseId", "reason" FROM "inventory_physical_counts" WHERE "id" = ${id} FOR UPDATE
    `;
    if (!docs[0]) throw new PhysicalCountError('INVENTORY_PHYSICAL_COUNT_NOT_FOUND', 404, 'Conteo físico no encontrado');
    if (docs[0].status === InventoryPhysicalCountStatus.POSTED) return getPhysicalCount(id, tx);
    if (docs[0].status !== InventoryPhysicalCountStatus.DRAFT) throw new PhysicalCountError('INVENTORY_PHYSICAL_COUNT_NOT_DRAFT', 409, 'El conteo no está en borrador');
    const items = await tx.inventoryPhysicalCountItem.findMany({ where: { physicalCountId: id }, orderBy: { productId: 'asc' } });
    if (items.length === 0 || items.some(item => item.countedQuantity === null)) {
      throw new PhysicalCountError('INVENTORY_PHYSICAL_COUNT_INCOMPLETE', 400, 'Todos los productos deben tener cantidad física');
    }
    await assertActiveWarehouse(tx, docs[0].warehouseId);
    for (const item of items) {
      await tx.$executeRaw`
        INSERT INTO "inventories" ("productId", "warehouseId", "quantity", "createdAt", "updatedAt")
        VALUES (${item.productId}, ${docs[0].warehouseId}, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("productId", "warehouseId") DO NOTHING
      `;
    }
    const productIds = items.map(item => item.productId);
    const balances = await tx.$queryRaw<Array<{ productId: number; quantity: number }>>`
      SELECT "productId", "quantity" FROM "inventories"
      WHERE "warehouseId" = ${docs[0].warehouseId} AND "productId" IN (${Prisma.join(productIds)})
      ORDER BY "productId" FOR UPDATE
    `;
    const balanceMap = new Map(balances.map(balance => [balance.productId, balance.quantity]));
    const stale = items.filter(item => balanceMap.get(item.productId) !== item.systemQuantitySnapshot)
      .map(item => ({ productId: item.productId, expected: item.systemQuantitySnapshot, current: balanceMap.get(item.productId) }));
    if (stale.length > 0) throw new PhysicalCountError('INVENTORY_PHYSICAL_COUNT_STALE', 409, 'El inventario cambió; actualiza y vuelve a contar los productos indicados', { products: stale });

    const products = await tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true, inputUnit: true, inputUnitQuantity: true, unitCost: true, unitOfMeasure: true } });
    const productMap = new Map(products.map(product => [product.id, product]));
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product || product.unitOfMeasure !== item.unit) throw new PhysicalCountError('INVENTORY_PHYSICAL_COUNT_PRODUCT_CHANGED', 409, 'La unidad de un producto cambió; crea un nuevo conteo');
      const counted = item.countedQuantity!;
      const variance = new Prisma.Decimal(counted).minus(item.systemQuantitySnapshot);
      const cost = productUnitCost(product);
      let movementId: number | null = null;
      if (!variance.isZero()) {
        const movement = await applyInventoryMovement(tx, MovementType.ADJUSTMENT, {
          productId: item.productId,
          quantity: variance.toNumber(),
          sourceWarehouseId: docs[0].warehouseId,
          adjustmentTargetQuantity: counted,
          notes: `Conteo físico #${id} · ${docs[0].reason}`,
        }, userId);
        movementId = movement.id;
      }
      await tx.inventoryPhysicalCountItem.update({
        where: { id: item.id },
        data: { varianceQuantity: variance.toNumber(), unitCostSnapshot: cost, estimatedValueVariance: variance.mul(cost), inventoryMovementId: movementId },
      });
    }
    await tx.inventoryPhysicalCount.update({
      where: { id },
      data: { status: InventoryPhysicalCountStatus.POSTED, postedAt: new Date(), postedById: userId, updatedById: userId },
    });
    return getPhysicalCount(id, tx);
  });
}

export async function cancelPhysicalCount(id: number, userId: number) {
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<{ status: InventoryPhysicalCountStatus }>>`
      SELECT "status" FROM "inventory_physical_counts" WHERE "id" = ${id} FOR UPDATE
    `;
    if (!rows[0]) throw new PhysicalCountError('INVENTORY_PHYSICAL_COUNT_NOT_FOUND', 404, 'Conteo físico no encontrado');
    if (rows[0].status === InventoryPhysicalCountStatus.CANCELLED) return getPhysicalCount(id, tx);
    if (rows[0].status !== InventoryPhysicalCountStatus.DRAFT) throw new PhysicalCountError('INVENTORY_PHYSICAL_COUNT_ALREADY_POSTED', 409, 'Un conteo publicado no puede cancelarse');
    await tx.inventoryPhysicalCount.update({ where: { id }, data: { status: InventoryPhysicalCountStatus.CANCELLED, cancelledAt: new Date(), cancelledById: userId, updatedById: userId } });
    return getPhysicalCount(id, tx);
  });
}

export async function physicalCountReferences(warehouseId?: number, search?: string) {
  const [warehouses, products, balances] = await Promise.all([
    prisma.warehouse.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, isMain: true, active: true } }),
    prisma.product.findMany({ where: { active: true, ...(search && { OR: [{ name: { contains: search, mode: 'insensitive' } }, { internalCode: { contains: search, mode: 'insensitive' } }] }) }, orderBy: { name: 'asc' }, select: { id: true, internalCode: true, name: true, unitOfMeasure: true, inputUnit: true, inputUnitQuantity: true, unitCost: true } }),
    warehouseId ? prisma.inventory.findMany({ where: { warehouseId }, select: { productId: true, quantity: true } }) : Promise.resolve([]),
  ]);
  const quantityMap = new Map(balances.map(balance => [balance.productId, balance.quantity]));
  return {
    warehouses,
    products: products.map(product => {
      let unitCostEstimate: string | null = null;
      try { unitCostEstimate = productUnitCost(product).toString(); } catch { /* El posting devolverá el error contractual detallado. */ }
      const { inputUnit, inputUnitQuantity, unitCost, ...summary } = product;
      return { ...summary, systemQuantity: quantityMap.get(product.id) ?? 0, unitCostEstimate };
    }),
  };
}
