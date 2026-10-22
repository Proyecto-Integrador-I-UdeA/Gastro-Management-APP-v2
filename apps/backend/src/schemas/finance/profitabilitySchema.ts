import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: YYYY-MM-DD')
  .refine(value => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'La fecha no es válida');

export const profitabilitySummaryQuerySchema = z
  .object({
    from: isoDate,
    to: isoDate,
    granularity: z.enum(['month', 'year']).default('month'),
  })
  .refine(value => value.from <= value.to, {
    message: 'from debe ser menor o igual a to',
    path: ['from'],
  })
  .refine(value => {
    const from = new Date(`${value.from}T00:00:00.000Z`).getTime();
    const to = new Date(`${value.to}T00:00:00.000Z`).getTime();
    return (to - from) / 86_400_000 <= 5 * 365;
  }, {
    message: 'El rango no puede exceder 5 años',
    path: ['to'],
  });

export type ProfitabilitySummaryQuery = z.infer<typeof profitabilitySummaryQuerySchema>;