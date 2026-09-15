import { z } from 'zod';

export const createWarehouseSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional().nullable(),
  active: z.boolean().optional().default(true),
  /** Si es true, el backend quita la marca en las demás bodegas */
  isMain: z.boolean().optional().default(false),
  purchaseReceiving: z.boolean().optional().default(false),
  kitchenConsumption: z.boolean().optional().default(false),
  barConsumption: z.boolean().optional().default(false),
});

export const updateWarehouseSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  active: z.boolean().optional(),
  isMain: z.boolean().optional(),
  purchaseReceiving: z.boolean().optional(),
  kitchenConsumption: z.boolean().optional(),
  barConsumption: z.boolean().optional(),
});
