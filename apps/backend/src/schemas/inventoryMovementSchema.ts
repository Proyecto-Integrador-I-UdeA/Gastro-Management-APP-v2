import { z } from 'zod';
import { MovementType } from '@prisma/client';

const movementTypeSchema = z.nativeEnum(MovementType);

const optionalPositiveInt = z
  .number()
  .int()
  .positive()
  .optional()
  .nullable();

export const createInventoryMovementSchema = z.object({
  type: movementTypeSchema,
  quantity: z.number().positive(),
  unitCost: z
    .union([z.number().min(0), z.string()])
    .optional()
    .transform((v) => (v === undefined ? undefined : typeof v === 'string' ? Number(v) : v)),
  expirationDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  productId: z.number().int().positive(),
  sourceWarehouseId: optionalPositiveInt,
  destinationWarehouseId: optionalPositiveInt,
});

export const patchTransferMovementSchema = z
  .object({
    notes: z.string().optional().nullable(),
    quantity: z.number().positive().optional(),
  })
  .refine((d) => d.notes !== undefined || d.quantity !== undefined, {
    message: 'Envía al menos notes o quantity',
  });
