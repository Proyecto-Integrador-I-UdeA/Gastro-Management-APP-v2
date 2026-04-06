import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createSupplierSchema, updateSupplierSchema } from '../../schemas/supplierSchema';

const prisma = new PrismaClient();

export const listSuppliers = async (req: Request, res: Response) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { id: 'asc' },
    });
    res.json(suppliers);
  } catch (error) {
    console.error('Error al listar proveedores:', error);
    res.status(500).json({ error: 'Error interno al listar proveedores' });
  }
};

export const getSupplierById = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: { products: true },
    });
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    res.json(supplier);
  } catch (error) {
    console.error('Error al obtener proveedor:', error);
    res.status(500).json({ error: 'Error interno' });
  }
};

export const createSupplier = async (req: Request, res: Response) => {
  const validation = createSupplierSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: validation.error.flatten().fieldErrors,
    });
  }

  const data = validation.data;

  try {
    // 🔥 GENERAR CÓDIGO AUTOMÁTICO PV-XXX
    const suppliersWithCode = await prisma.supplier.findMany({
      where: {
        internalCode: {
          startsWith: 'PV-',
        },
      },
      select: {
        internalCode: true,
      },
    });

    let maxNumber = 0;

    for (const s of suppliersWithCode) {
      const num = parseInt(s.internalCode.split('-')[1]);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }

    const nextNumber = maxNumber + 1;
    const newCode = `PV-${String(nextNumber).padStart(3, '0')}`;

    const supplier = await prisma.supplier.create({
      data: {
        internalCode: newCode, // 🔥 AQUÍ EL CAMBIO
        name: data.name,
        taxId: data.taxId,
        phone: data.phone,
        address: data.address,
        contactPerson: data.contactPerson,
      },
    });

    res.status(201).json(supplier);
  } catch (error: unknown) {
    const err = error as { code?: string };

    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Código interno duplicado' });
    }

    console.error('Error al crear proveedor:', error);
    res.status(500).json({ error: 'Error interno al crear proveedor' });
  }
};

export const updateSupplier = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  const validation = updateSupplierSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: validation.error.flatten().fieldErrors,
    });
  }

  const data = validation.data;

  try {
    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
  
        ...(data.name !== undefined && { name: data.name }),
        ...(data.taxId !== undefined && { taxId: data.taxId }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.contactPerson !== undefined && { contactPerson: data.contactPerson }),
        ...(data.active !== undefined && { active: data.active }),
      },
    });

    res.json(supplier);
  } catch (error: unknown) {
    const err = error as { code?: string };

    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    console.error('Error al actualizar proveedor:', error);
    res.status(500).json({ error: 'Error interno al actualizar proveedor' });
  }
};

export const deleteSupplier = async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  try {
    await prisma.supplier.delete({ where: { id } });
    res.status(204).send();
  } catch (error: unknown) {
    const err = error as { code?: string };

    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    if (err.code === 'P2003') {
      return res.status(409).json({
        error: 'Cannot delete supplier: it has associated products',
      });
    }

    console.error('Error al eliminar proveedor:', error);
    res.status(500).json({ error: 'Error interno al eliminar proveedor' });
  }
};