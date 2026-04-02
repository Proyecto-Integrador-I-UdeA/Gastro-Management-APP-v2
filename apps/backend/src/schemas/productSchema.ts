import { z } from 'zod';

export const createProductSchema = z.object({
  internalCode: z.string().min(1, 'Código interno requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  category: z.string().optional().default(''),
  isIngredient: z.boolean().optional().default(false),
  isSupply: z.boolean().optional().default(false),
  isFinishedProduct: z.boolean().optional().default(false),
  presentation: z.string().min(1, 'Presentación requerida'),
  unitOfMeasure: z.string().min(1, 'Unidad de medida requerida'),
  inputUnit: z.string().min(1).optional().default('g'),
  inputUnitQuantity: z.number().positive().optional().default(1),
  minStock: z.number().min(0),
  maxStock: z.number().min(0),
  unitCost: z.number().min(0).or(z.string().transform((v) => Number(v))),
  supplierId: z.number().int().positive(),
  active: z.boolean().optional().default(true),
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
  inputUnit: z.string().min(1).optional(),
  inputUnitQuantity: z.number().positive().optional(),
  minStock: z.number().min(0).optional(),
  maxStock: z.number().min(0).optional(),
  unitCost: z.number().min(0).or(z.string().transform((v) => Number(v))).optional(),
  supplierId: z.number().int().positive().optional(),
  active: z.boolean().optional(),
});
