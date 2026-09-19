import { z } from 'zod';

const requiredText = (label: string, max: number) => z
  .string()
  .trim()
  .min(1, `${label} es obligatorio`)
  .max(max, `${label} no puede superar ${max} caracteres`);

const optionalText = (max: number) => z
  .union([z.string().trim().max(max), z.null()])
  .optional()
  .transform(value => value === '' ? null : value);

export const reservationTypeSchema = z.enum([
  'TABLE_RESERVATION',
  'PRIVATE_EVENT',
  'CORPORATE_EVENT',
  'OTHER',
]);

export const reservationStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
  'COMPLETED',
]);

export const reservationScheduledAtSchema = z.string().trim().refine(value => {
  if (!/T/.test(value) || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  return Number.isFinite(new Date(value).getTime());
}, 'scheduledAt debe ser una fecha/hora ISO con zona horaria');

const reservationWriteFields = {
  customerName: requiredText('Cliente / responsable', 200),
  phone: requiredText('Teléfono', 50),
  email: z.union([z.string().trim().email('Correo electrónico inválido').max(320), z.literal(''), z.null()])
    .optional()
    .transform(value => value === undefined ? undefined : value || null),
  reservationType: reservationTypeSchema,
  scheduledAt: reservationScheduledAtSchema,
  guestCount: z.coerce.number().int('Número de personas inválido').positive('Número de personas debe ser mayor que 0'),
  preferredArea: optionalText(120),
  diningTableId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  reason: requiredText('Motivo', 500),
  notes: optionalText(4000),
  isVip: z.boolean().optional().default(false),
};

export const createReservationSchema = z.object({
  ...reservationWriteFields,
  status: z.enum(['PENDING', 'CONFIRMED']).default('PENDING'),
}).strict();

export const updateReservationSchema = z.object({
  customerName: reservationWriteFields.customerName.optional(),
  phone: reservationWriteFields.phone.optional(),
  email: reservationWriteFields.email,
  reservationType: reservationWriteFields.reservationType.optional(),
  scheduledAt: reservationWriteFields.scheduledAt.optional(),
  guestCount: reservationWriteFields.guestCount.optional(),
  preferredArea: reservationWriteFields.preferredArea,
  diningTableId: reservationWriteFields.diningTableId,
  reason: reservationWriteFields.reason.optional(),
  notes: reservationWriteFields.notes,
  isVip: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'Debe indicar al menos un campo editable');

export const reservationSearchSchema = z.object({
  search: z.string().trim().max(200).optional(),
}).strict();

export const rescheduleReservationSchema = z.object({
  scheduledAt: reservationScheduledAtSchema,
  reason: optionalText(500),
}).strict();

export const cancelReservationSchema = z.object({
  reason: requiredText('Motivo de cancelación', 500),
}).strict();

export const emptyReservationActionSchema = z.object({}).strict();
export const reservationIdSchema = z.coerce.number().int().positive();

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;
export type RescheduleReservationInput = z.infer<typeof rescheduleReservationSchema>;
