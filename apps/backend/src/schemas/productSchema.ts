import { z } from 'zod';
import { ProductBaseUnit } from '@prisma/client';

export const createProductSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  category: z.string().optional().default(''),

  isIngredient: z.boolean().optional().default(false),
  isSupply: z.boolean().optional().default(false),
  isFinishedProduct: z.boolean().optional().default(false),

  presentation: z.string().min(1, 'Presentación requerida'),
 
  unitOfMeasure: z.nativeEnum(ProductBaseUnit),

  inputUnit: z.string().min(1).optional().default('g'),
  inputUnitQuantity: z.number().positive().optional().default(1),

  minStock: z.number().min(0),
  maxStock: z.number().min(0),

  supplierId: z.number().int().positive(),
  unitCost: z.number().min(0).optional().default(0),

  catalogId: z.number().int().positive().nullable().optional(),

  caloriesPer100g: z.number().nullable().optional(),
  carbsPer100g: z.number().nullable().optional(),
  fatPer100g: z.number().nullable().optional(),
  proteinPer100g: z.number().nullable().optional(),
  sugarPer100g: z.number().nullable().optional(),
  sodiumPer100g: z.number().nullable().optional(),

  active: z.boolean().optional().default(true),
}).refine((d) => d.minStock <= d.maxStock, {
  message: 'El stock mínimo no puede ser mayor que el stock máximo.',
  path: ['maxStock'],
});

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),

  isIngredient: z.boolean().optional(),
  isSupply: z.boolean().optional(),
  isFinishedProduct: z.boolean().optional(),

  presentation: z.string().min(1).optional(),
  
  unitOfMeasure: z.nativeEnum(ProductBaseUnit).optional(),

  inputUnit: z.string().min(1).optional(),
  inputUnitQuantity: z.number().positive().optional(),

  minStock: z.number().min(0).optional(),
  maxStock: z.number().min(0).optional(),

  supplierId: z.number().int().positive().optional(),
  unitCost: z.number().min(0).optional(),

  catalogId: z.number().int().positive().nullable().optional(),

  caloriesPer100g: z.number().nullable().optional(),
  carbsPer100g: z.number().nullable().optional(),
  fatPer100g: z.number().nullable().optional(),
  proteinPer100g: z.number().nullable().optional(),
  sugarPer100g: z.number().nullable().optional(),
  sodiumPer100g: z.number().nullable().optional(),

  active: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (
    data.minStock !== undefined &&
    data.maxStock !== undefined &&
    data.minStock > data.maxStock
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'El stock mínimo no puede ser mayor que el stock máximo.',
      path: ['maxStock'],
    });
  }
});