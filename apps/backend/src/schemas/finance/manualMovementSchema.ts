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

const currency = z.string().trim().regex(/^[A-Z]{3}$/, 'Moneda ISO 4217 (3 letras mayúsculas)');

const documentNumber = z
  .union([z.string(), z.null()])
  .transform(value => value === null ? null : value.trim() || null)
  .optional();

export const createManualMovementSchema = z.object({
  kind: z.enum(['INCOME', 'EXPENSE']),
  occurredAt: isoDate,
  concept: z.string().trim().min(1, 'El concepto es obligatorio').max(300),
  amount: positiveAmount,
  currency: currency.default('COP'),
  documentNumber,
  counterpartyId: z.coerce.number().int().positive().optional().nullable(),
  paymentMethodId: z.coerce.number().int().positive(),
  status: z.enum(['POSTED', 'PENDING']).default('POSTED'),
}).strict();

export const updateManualMovementSchema = z.object({
  occurredAt: isoDate.optional(),
  concept: z.string().trim().min(1).max(300).optional(),
  amount: positiveAmount.optional(),
  documentNumber,
  counterpartyId: z.coerce.number().int().positive().optional().nullable(),
  paymentMethodId: z.coerce.number().int().positive().optional(),
  kind: z.enum(['INCOME', 'EXPENSE']).optional(),
}).strict().refine(
  value => Object.keys(value).length > 0,
  'Debe indicar al menos un campo editable',
);

export const cancelManualMovementSchema = z.object({
  reason: z.string().trim().min(1, 'El motivo de cancelación es obligatorio').max(500),
}).strict();

export const confirmManualMovementSchema = z.object({}).strict();

export const manualMovementIdSchema = z.coerce.number().int().positive();

export const listManualMovementsQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  kind: z.enum(['INCOME', 'EXPENSE']).optional(),
  status: z.enum(['POSTED', 'PENDING', 'CANCELLED']).optional(),
  paymentMethodId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(120).optional(),
}).refine(
  value => !value.from || !value.to || value.from <= value.to,
  { message: 'from debe ser menor o igual a to', path: ['from'] },
);

export const manualMovementSummaryQuerySchema = z.object({
  date: isoDate.optional(),
});

export type CreateManualMovementInput = z.infer<typeof createManualMovementSchema>;
export type UpdateManualMovementInput = z.infer<typeof updateManualMovementSchema>;
export type CancelManualMovementInput = z.infer<typeof cancelManualMovementSchema>;
export type ListManualMovementsQuery = z.infer<typeof listManualMovementsQuerySchema>;
export type ManualMovementSummaryQuery = z.infer<typeof manualMovementSummaryQuerySchema>;