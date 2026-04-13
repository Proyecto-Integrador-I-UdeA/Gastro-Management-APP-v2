import { z } from 'zod';
import { MovementType } from '@prisma/client';

const movementTypeSchema = z.nativeEnum(MovementType);

/** Acepta número o string numérico; null / vacío → undefined. */
const optionalPositiveInt = z.preprocess((val) => {
  if (val === undefined || val === null || val === '') return undefined;
  const n = typeof val === 'string' ? Number.parseInt(val, 10) : Number(val);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}, z.number().int().positive().optional());

export const createInventoryMovementSchema = z
  .object({
    type: movementTypeSchema,
    quantity: z.coerce.number().positive(),
    unitCost: z.preprocess(
      (val) => (val === '' || val === undefined || val === null ? undefined : val),
      z.coerce.number().min(0).optional().nullable()
    ),
    expirationDate: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    productId: z.coerce.number().int().positive(),
    sourceWarehouseId: optionalPositiveInt,
    destinationWarehouseId: optionalPositiveInt,
  })
  .superRefine((data, ctx) => {
    if (data.type === MovementType.PURCHASE) {
      if (data.destinationWarehouseId == null || data.destinationWarehouseId === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Bodega destino requerida para entrada por compra',
          path: ['destinationWarehouseId'],
        });
      }
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
  })
  .refine((d) => d.notes !== undefined || d.quantity !== undefined, {
    message: 'Envía al menos un campo a actualizar',
  });
