import { z } from 'zod';

export const financeExpenseMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'El periodo debe tener el formato YYYY-MM');

const conceptSchema = z
  .string()
  .trim()
  .min(1, 'El concepto es obligatorio')
  .max(200, 'El concepto no puede superar 200 caracteres');

const amountSchema = z
  .number()
  .finite()
  .min(0, 'El valor no puede ser negativo');

const periodicitySchema = z.enum(['MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'ANNUAL']);
const kindSchema = z.enum(['FIXED', 'VARIABLE']);

export const listFinanceExpensesQuerySchema = z.object({
  month: financeExpenseMonthSchema,
});

const financeExpenseBase = {
  month: financeExpenseMonthSchema,
  concept: conceptSchema,
  amount: amountSchema,
  active: z.boolean().optional().default(true),
};

export const createFinanceExpenseSchema = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('FIXED'),
      ...financeExpenseBase,
      periodicity: periodicitySchema,
      base: z.null().optional(),
    }),
    z.object({
      kind: z.literal('VARIABLE'),
      ...financeExpenseBase,
      base: z
        .string()
        .trim()
        .min(1, 'La base es obligatoria')
        .max(200, 'La base no puede superar 200 caracteres'),
      periodicity: z.null().optional(),
    }),
  ]);

export const updateFinanceExpenseSchema = z
  .object({
    kind: kindSchema.optional(),
    month: financeExpenseMonthSchema.optional(),
    concept: conceptSchema.optional(),
    amount: amountSchema.optional(),
    active: z.boolean().optional(),
    periodicity: periodicitySchema.nullable().optional(),
    base: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .nullable()
      .optional(),
  })
  .strict();

export type CreateFinanceExpenseInput = z.infer<typeof createFinanceExpenseSchema>;
export type UpdateFinanceExpenseInput = z.infer<typeof updateFinanceExpenseSchema>;
