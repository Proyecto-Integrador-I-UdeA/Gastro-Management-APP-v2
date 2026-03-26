import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { createProductSchema, updateProductSchema } from '../../schemas/productSchema';

const prisma = new PrismaClient();

export const listProducts = async (req: Request, res: Response) => {
  try {
    const includeSupplier = req.query.include === 'supplier';
    const products = await prisma.product.findMany({
      orderBy: { id: 'asc' },
      include: includeSupplier ? { supplier: true } : undefined,
    });
    res.json(products);
  } catch (error) {
    console.error('Error al listar productos:', error);
    res.status(500).json({ error: 'Error interno al listar productos' });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { supplier: true },
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).json({ error: 'Error interno' });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  const validation = createProductSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: validation.error.flatten().fieldErrors,
    });
  }
  const data = validation.data;
  try {
    const product = await prisma.product.create({
      data: {
        internalCode: data.internalCode,
        name: data.name,
        category: data.category ?? '',
        isIngredient: data.isIngredient,
        isSupply: data.isSupply,
        isFinishedProduct: data.isFinishedProduct,
        presentation: data.presentation,
        unitOfMeasure: data.unitOfMeasure,
        expirationDate: data.expirationDate ?? null,
        minStock: data.minStock,
        maxStock: data.maxStock,
        currentStock: data.currentStock,
        unitCost: new Prisma.Decimal(data.unitCost),
        supplierId: data.supplierId,
      },
      include: { supplier: true },
    });
    res.status(201).json(product);
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'P2003') {
      return res.status(400).json({ error: 'Invalid supplierId' });
    }
    console.error('Error al crear producto:', error);
    res.status(500).json({ error: 'Error interno al crear producto' });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  const validation = updateProductSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: validation.error.flatten().fieldErrors,
    });
  }
  const data = validation.data;
  const updateData: Prisma.ProductUpdateInput = {};
  if (data.internalCode !== undefined) updateData.internalCode = data.internalCode;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.isIngredient !== undefined) updateData.isIngredient = data.isIngredient;
  if (data.isSupply !== undefined) updateData.isSupply = data.isSupply;
  if (data.isFinishedProduct !== undefined) updateData.isFinishedProduct = data.isFinishedProduct;
  if (data.presentation !== undefined) updateData.presentation = data.presentation;
  if (data.unitOfMeasure !== undefined) updateData.unitOfMeasure = data.unitOfMeasure;
  if (data.expirationDate !== undefined) updateData.expirationDate = data.expirationDate;
  if (data.minStock !== undefined) updateData.minStock = data.minStock;
  if (data.maxStock !== undefined) updateData.maxStock = data.maxStock;
  if (data.currentStock !== undefined) updateData.currentStock = data.currentStock;
  if (data.unitCost !== undefined) updateData.unitCost = new Prisma.Decimal(data.unitCost);
  if (data.supplierId !== undefined) updateData.supplier = { connect: { id: data.supplierId } };
  if (data.active !== undefined) updateData.active = data.active;

  try {
    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: { supplier: true },
    });
    res.json(product);
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Product not found' });
    }
    if (err.code === 'P2003') {
      return res.status(400).json({ error: 'Invalid supplierId' });
    }
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ error: 'Error interno al actualizar producto' });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  try {
    await prisma.product.delete({ where: { id } });
    res.status(204).send();
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Product not found' });
    }
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ error: 'Error interno al eliminar producto' });
  }
};
