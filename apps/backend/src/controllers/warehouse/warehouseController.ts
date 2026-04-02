import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { createWarehouseSchema, updateWarehouseSchema } from '../../schemas/warehouseSchema';

export const listWarehouses = async (req: Request, res: Response) => {
  try {
    const activeOnly = req.query.active === 'true';
    const warehouses = await prisma.warehouse.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { name: 'asc' },
    });
    res.json(warehouses);
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
    const warehouse = await prisma.warehouse.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        active: data.active ?? true,
      },
    });
    res.status(201).json(warehouse);
  } catch (error: unknown) {
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
    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.active !== undefined && { active: data.active }),
      },
    });
    res.json(warehouse);
  } catch (error: unknown) {
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
