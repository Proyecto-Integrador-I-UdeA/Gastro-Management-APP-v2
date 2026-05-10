import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { createProductSchema, updateProductSchema } from '../../schemas/productSchema';
import { Prisma } from '@prisma/client';

export const listProducts = async (req: Request, res: Response) => {
  try {
    const includeSupplier = req.query.include === 'supplier';
    const supplierIdRaw = req.query.supplierId;
    const supplierIdStr = Array.isArray(supplierIdRaw)
      ? supplierIdRaw[0]
      : supplierIdRaw;
    const where: Prisma.ProductWhereInput = {};
    if (supplierIdStr !== undefined && supplierIdStr !== '') {
      const sid = parseInt(String(supplierIdStr), 10);
      if (!Number.isNaN(sid)) {
        where.supplierId = sid;
      }
    }
    const products = await prisma.product.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
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
    console.log("📦 PRODUCTO DESDE DB:", product);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).json({ error: 'Error interno' });
  }
};
console.log("ANTES DEL REQUEST");
export const createProduct = async (req: Request, res: Response) => {
  const validation = createProductSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: validation.error.issues,
    });
  }

  const data = validation.data;

  try {
    const lastProduct = await prisma.product.findFirst({
      orderBy: { id: 'desc' },
    });

    let nextNumber = 1;

    if (lastProduct?.internalCode) {
      const lastCode = lastProduct.internalCode;
      const lastNumber = parseInt(lastCode.split('-')[1]);

      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
     console.log("DESPUÉS DEL REQUEST"); 
    }

    const newCode = `P-${String(nextNumber).padStart(3, '0')}`;

    const product = await prisma.product.create({
      data: {
        internalCode: newCode,
        name: data.name,
        category: data.category ?? '',
        isIngredient: data.isIngredient,
        isSupply: data.isSupply,
        isFinishedProduct: data.isFinishedProduct,
        presentation: data.presentation,
        unitOfMeasure: data.unitOfMeasure,
        inputUnit: data.inputUnit,
        inputUnitQuantity: data.inputUnitQuantity,
        minStock: data.minStock,
        maxStock: data.maxStock,
        supplierId: data.supplierId,
        unitCost: data.unitCost ?? 0,
        active: data.active ?? true,
      },
      include: { supplier: true },
    });

    res.status(201).json(product);
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        return res.status(400).json({ error: 'Invalid supplierId' });
      }
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Código interno ya existe' });
      }
    }

    console.error('Error al crear producto:', error);
    res.status(500).json({ error: 'Error interno al crear producto' });
  }
};

const buildUpdateData = (data: any): any => {
  const updateData: any = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.isIngredient !== undefined) updateData.isIngredient = data.isIngredient;
  if (data.isSupply !== undefined) updateData.isSupply = data.isSupply;
  if (data.isFinishedProduct !== undefined) updateData.isFinishedProduct = data.isFinishedProduct;
  if (data.presentation !== undefined) updateData.presentation = data.presentation;
  if (data.unitCost !== undefined) updateData.unitCost = Number(data.unitCost);
  if (data.unitOfMeasure !== undefined) updateData.unitOfMeasure = data.unitOfMeasure;
  if (data.inputUnit !== undefined) updateData.inputUnit = data.inputUnit;
  if (data.inputUnitQuantity !== undefined) updateData.inputUnitQuantity = data.inputUnitQuantity;
  if (data.minStock !== undefined) updateData.minStock = data.minStock;
  if (data.maxStock !== undefined) updateData.maxStock = data.maxStock;
  if (data.supplierId !== undefined) updateData.supplier = { connect: { id: data.supplierId } };
  if (data.active !== undefined) updateData.active = data.active;

  return updateData;
};

export const updateProduct = async (req: Request, res: Response) => {
  console.log("📥 BODY BACKEND:", req.body);
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
  const updateData = buildUpdateData(data);

  try {
    const existing = await prisma.product.findUnique({
      where: { id },
      select: { minStock: true, maxStock: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const nextMin = data.minStock !== undefined ? data.minStock : existing.minStock;
    const nextMax = data.maxStock !== undefined ? data.maxStock : existing.maxStock;
    if (nextMin > nextMax) {
      return res.status(400).json({
        error: 'El stock mínimo no puede ser mayor que el stock máximo.',
      });
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: { supplier: true },
    });

    res.json(product);
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Product not found' });
      }

      if (error.code === 'P2003') {
        return res.status(400).json({ error: 'Invalid supplierId' });
      }
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Código interno ya existe' });
      }
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
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Product not found' });
      }
    }

    console.error('Error al eliminar producto:', error);
    res.status(500).json({ error: 'Error interno al eliminar producto' });
  }
};