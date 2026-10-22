import { z } from 'zod';
import { Prisma } from '@prisma/client';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: YYYY-MM-DD')
  .refine(value => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'La fecha no es válida');

const moneyString = z.preprocess(
  value => typeof value === 'number' ? String(value) : value,
  z.string().trim().regex(/^\d{1,12}(?:\.\d{1,2})?$/, 'Importe no negativo con máximo dos decimales'),
);

const positiveAmount = moneyString.pipe(
  z.string().refine(
    value => new Prisma.Decimal(value).gt(0),
    'El importe debe ser mayor a 0',
  ),
);

const documentNumber = z
  .union([z.string(), z.null()])
  .transform(value => value === null ? null : value.trim() || null)
  .optional();

export const createTransferSchema = z.object({
  occurredAt: isoDate,
  sourceMethodId: z.coerce.number().int().positive(),
  targetMethodId: z.coerce.number().int().positive(),
  amount: positiveAmount,
  description: z.string().trim().min(1, 'La descripción es obligatoria').max(300),
  documentNumber,
}).strict().refine(
  value => value.sourceMethodId !== value.targetMethodId,
  { message: 'Origen y destino deben ser distintos', path: ['targetMethodId'] },
);

export const transferIdSchema = z.coerce.number().int().positive();

export const listTransfersQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  sourceMethodId: z.coerce.number().int().positive().optional(),
  targetMethodId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(120).optional(),
}).refine(
  value => !value.from || !value.to || value.from <= value.to,
  { message: 'from debe ser menor o igual a to', path: ['from'] },
);

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type ListTransfersQuery = z.infer<typeof listTransfersQuerySchema>;