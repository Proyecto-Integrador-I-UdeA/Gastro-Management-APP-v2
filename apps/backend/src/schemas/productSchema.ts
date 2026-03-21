import { z } from 'zod';

export const createProductSchema = z.object({
  internalCode: z.string().min(1, 'Código interno requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  category: z.string().optional().default(''),
  isIngredient: z.boolean(),
  isSupply: z.boolean(),
  isFinishedProduct: z.boolean(),
  presentation: z.string().min(1, 'Presentación requerida'),
  unitOfMeasure: z.string().min(1, 'Unidad de medida requerida'),
  expirationDate: z.string().nullable().optional().transform((v) => (v != null && v !== '' ? new Date(v) : null)),
  minStock: z.number().min(0),
  maxStock: z.number().min(0),
  currentStock: z.number().min(0),
  unitCost: z.number().min(0).or(z.string().transform((v) => Number(v))),
  supplierId: z.number().int().positive(),
});

export const updateProductSchema = z.object({
  internalCode: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  isIngredient: z.boolean().optional(),
  isSupply: z.boolean().optional(),
  isFinishedProduct: z.boolean().optional(),
  presentation: z.string().min(1).optional(),
  unitOfMeasure: z.string().min(1).optional(),
  expirationDate: z.string().nullable().optional().transform((v) => (v != null && v !== '' ? new Date(v) : null)),
  minStock: z.number().min(0).optional(),
  maxStock: z.number().min(0).optional(),
  currentStock: z.number().min(0).optional(),
  unitCost: z.number().min(0).or(z.string().transform((v) => Number(v))).optional(),
  supplierId: z.number().int().positive().optional(),
});
