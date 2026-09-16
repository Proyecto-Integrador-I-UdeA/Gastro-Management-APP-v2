import { z } from 'zod';
import { Prisma } from '@prisma/client';

const money = z.preprocess(
  value => typeof value === 'number' ? String(value) : value,
  z.string().trim().regex(/^\d{1,12}(?:\.\d{1,2})?$/, 'Usa un importe no negativo con máximo dos decimales'),
);

export const serviceConfigSchema = z.object({
  servicePercent: money.pipe(z.string().refine(value => new Prisma.Decimal(value).lte(100), 'El servicio debe estar entre 0 y 100')),
});

export const openCashSessionSchema = z.object({
  cashRegisterId: z.number().int().positive().optional(),
  openingCash: money,
});

export const orderParamSchema = z.object({
  orderId: z.coerce.number().int().positive(),
});

export const preInvoiceSchema = z.object({
  serviceAccepted: z.boolean(),
});

export const paymentSchema = z.object({
  preInvoiceId: z.number().int().positive(),
  method: z.enum(['CASH', 'CARD', 'TRANSFER', 'OTHER']),
  cashSessionId: z.number().int().positive().optional(),
  amount: money.pipe(z.string().refine(value => new Prisma.Decimal(value).gt(0), 'El pago debe ser mayor que cero')),
  amountTendered: money.optional(),
  idempotencyKey: z.string().trim().min(8).max(120),
});

export const closeCashSessionSchema = z.object({
  countedCash: money,
});

export const dateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'La fecha no es válida').optional(),
});
