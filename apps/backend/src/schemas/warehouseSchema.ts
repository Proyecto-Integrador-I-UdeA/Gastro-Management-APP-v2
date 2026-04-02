import { z } from 'zod';

export const createWarehouseSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional().nullable(),
  active: z.boolean().optional().default(true),
});

export const updateWarehouseSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  active: z.boolean().optional(),
});
