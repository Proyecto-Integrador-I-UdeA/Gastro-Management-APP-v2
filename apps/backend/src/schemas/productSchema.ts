import { z } from 'zod';

const baseUnitSchema = z.enum(['g', 'ml', 'und']);

export const createProductSchema = z.object({
  internalCode: z.string().min(1, 'Código interno requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  category: z.string().optional().default(''),
  isIngredient: z.boolean(),
  isSupply: z.boolean(),
  isFinishedProduct: z.boolean(),
  presentation: z.string().min(1, 'Presentación requerida'),
  unitOfMeasure: baseUnitSchema,
  inputUnit: z.string().min(1, 'Unidad ingresada requerida'),
  inputUnitQuantity: z.number().positive('Cantidad por unidad ingresada inválida'),
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
  unitOfMeasure: baseUnitSchema.optional(),
  inputUnit: z.string().min(1).optional(),
  inputUnitQuantity: z.number().positive().optional(),
  expirationDate: z.string().nullable().optional().transform((v) => (v != null && v !== '' ? new Date(v) : null)),
  minStock: z.number().min(0).optional(),
  maxStock: z.number().min(0).optional(),
  currentStock: z.number().min(0).optional(),
  unitCost: z.number().min(0).or(z.string().transform((v) => Number(v))).optional(),
  supplierId: z.number().int().positive().optional(),
  active: z.boolean().optional(),
});
