import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';

export const listInventories = async (req: Request, res: Response) => {
  try {
    const warehouseId = req.query.warehouseId
      ? parseInt(String(req.query.warehouseId), 10)
      : undefined;
    const productId = req.query.productId
      ? parseInt(String(req.query.productId), 10)
      : undefined;

    const where: Prisma.InventoryWhereInput = {};
    if (warehouseId != null && !Number.isNaN(warehouseId)) {
      where.warehouseId = warehouseId;
    }
    if (productId != null && !Number.isNaN(productId)) {
      where.productId = productId;
    }

    const rows = await prisma.inventory.findMany({
      where,
      orderBy: [{ warehouseId: 'asc' }, { productId: 'asc' }],
      include: {
        product: { include: { supplier: true } },
        warehouse: true,
      },
    });
    res.json(rows);
  } catch (error) {
    console.error('Error al listar inventarios:', error);
    res.status(500).json({ error: 'Error interno al listar inventarios' });
  }
};
