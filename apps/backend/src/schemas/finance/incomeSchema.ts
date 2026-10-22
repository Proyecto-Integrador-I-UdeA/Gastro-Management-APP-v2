import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: YYYY-MM-DD')
  .refine(value => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'La fecha no es válida');

const booleanQuery = z.preprocess(value => {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

export const incomeSummaryQuerySchema = z
  .object({
    from: isoDate,
    to: isoDate,
    recognition: z.enum(['accrual', 'cash']).default('accrual'),
    granularity: z.enum(['day', 'week', 'month', 'year']).default('month'),
    includeService: booleanQuery,
  })
  .refine(value => value.from <= value.to, {
    message: 'from debe ser menor o igual a to',
    path: ['from'],
  })
  .refine(value => {
    const from = new Date(`${value.from}T00:00:00.000Z`).getTime();
    const to = new Date(`${value.to}T00:00:00.000Z`).getTime();
    return (to - from) / 86_400_000 <= 3 * 365;
  }, {
    message: 'El rango no puede exceder 3 años',
    path: ['to'],
  });

export type IncomeSummaryQuery = z.infer<typeof incomeSummaryQuerySchema>;