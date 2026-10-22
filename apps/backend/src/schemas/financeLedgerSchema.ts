import { z } from 'zod';
import { financeExpenseMonthSchema } from './financeExpenseSchema';

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato YYYY-MM-DD');

const amountSchema = z.number().finite().positive('El valor debe ser mayor a 0');

const invoiceNumberSchema = z
  .string()
  .trim()
  .max(80)
  .optional()
  .transform(value => value || undefined);

export const listFinanceLedgerQuerySchema = z.object({
  month: financeExpenseMonthSchema,
});

export const createFinanceLedgerSchema = z
  .discriminatedUnion('side', [
    z.object({
      side: z.literal('PAYABLE'),
      supplierId: z.number().int().positive('El proveedor es obligatorio'),
      partyName: z.null().optional(),
      invoiceNumber: invoiceNumberSchema,
      issuedAt: dateOnlySchema,
      dueAt: dateOnlySchema,
      amount: amountSchema,
    }),
    z.object({
      side: z.literal('RECEIVABLE'),
      partyName: z.string().trim().min(1, 'El cliente es obligatorio').max(200),
      supplierId: z.null().optional(),
      issuedAt: dateOnlySchema,
      dueAt: dateOnlySchema,
      amount: amountSchema,
    }),
  ])
  .refine(value => value.dueAt >= value.issuedAt, {
    message: 'El vencimiento no puede ser anterior a la emisión',
    path: ['dueAt'],
  });

export const updateFinanceLedgerSchema = z
  .object({
    supplierId: z.number().int().positive().nullable().optional(),
    partyName: z.string().trim().min(1).max(200).nullable().optional(),
    invoiceNumber: z.string().trim().max(80).nullable().optional()
      .transform(value => (value === '' ? null : value)),
    issuedAt: dateOnlySchema.optional(),
    dueAt: dateOnlySchema.optional(),
    amount: amountSchema.optional(),
  });

export const createFinanceLedgerPaymentSchema = z.object({
  amount: amountSchema,
  paidAt: dateOnlySchema.optional(),
  note: z.string().trim().max(200).nullable().optional(),
});

export type CreateFinanceLedgerInput = z.infer<typeof createFinanceLedgerSchema>;
export type UpdateFinanceLedgerInput = z.infer<typeof updateFinanceLedgerSchema>;
export type CreateFinanceLedgerPaymentInput = z.infer<typeof createFinanceLedgerPaymentSchema>;
