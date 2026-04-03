import { z } from 'zod';
import { MovementType } from '@prisma/client';

const movementTypeSchema = z.nativeEnum(MovementType);

const optionalPositiveInt = z
  .number()
  .int()
  .positive()
  .optional()
  .nullable();

export const createInventoryMovementSchema = z
  .object({
    type: movementTypeSchema,
    quantity: z.number().positive(),
    unitCost: z.number().min(0).optional().nullable(),
    expirationDate: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    productId: z.number().int().positive(),
    sourceWarehouseId: optionalPositiveInt,
    destinationWarehouseId: optionalPositiveInt,
  })
  .superRefine((data, ctx) => {
    if (data.type === MovementType.PURCHASE) {
      if (
        data.unitCost === undefined ||
        data.unitCost === null ||
        Number.isNaN(data.unitCost)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Costo unitario requerido para entrada por compra',
          path: ['unitCost'],
        });
      }
    } else if (data.unitCost !== undefined && data.unitCost !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El costo unitario solo aplica a entradas por compra',
        path: ['unitCost'],
      });
    }
  });

export const patchTransferMovementSchema = z
  .object({
    notes: z.string().optional().nullable(),
    quantity: z.number().positive().optional(),
    expirationDate: z.string().optional().nullable(),
  })
  .refine(
    (d) =>
      d.notes !== undefined ||
      d.quantity !== undefined ||
      d.expirationDate !== undefined,
    { message: 'Envía al menos un campo a actualizar' }
  );
