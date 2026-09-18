import { z } from 'zod';

export const salesAnalyticsQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month', 'year', 'custom']).default('day'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  menuItemId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
}).superRefine((value, context) => {
  const periodFields = ['date', 'week', 'month', 'year', 'from', 'to'] as const;
  const addUnexpectedFieldIssue = (field: typeof periodFields[number]) => {
    if (value[field] !== undefined) context.addIssue({ code: 'custom', path: [field], message: `El parámetro ${field} no aplica al periodo seleccionado` });
  };

  if (value.period === 'day') {
    for (const field of ['week', 'month', 'year', 'from', 'to'] as const) addUnexpectedFieldIssue(field);
  }
  if (value.period === 'week') {
    for (const field of ['date', 'month', 'year', 'from', 'to'] as const) addUnexpectedFieldIssue(field);
  }
  if (value.period === 'month') {
    for (const field of ['date', 'week', 'year', 'from', 'to'] as const) addUnexpectedFieldIssue(field);
  }
  if (value.period === 'year') {
    for (const field of ['date', 'week', 'month', 'from', 'to'] as const) addUnexpectedFieldIssue(field);
  }
  if (value.period === 'custom' && (!value.from || !value.to)) {
    context.addIssue({ code: 'custom', path: ['from'], message: 'El periodo personalizado requiere from y to' });
  }
  if (value.period === 'custom') {
    for (const field of ['date', 'week', 'month', 'year'] as const) addUnexpectedFieldIssue(field);
  }
});

export type SalesAnalyticsQuery = z.infer<typeof salesAnalyticsQuerySchema>;
