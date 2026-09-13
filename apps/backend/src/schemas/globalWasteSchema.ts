import { z } from 'zod';

export const globalWasteInputSchema = z.object({
  wastePercent: z.union([
    z.number().finite(),
    z.string().trim().min(1),
  ]).refine(
    value => /^\d+(?:\.\d{1,2})?$/.test(String(value).trim()),
    { message: 'wastePercent admite máximo 2 posiciones decimales' },
  ).transform(value => Number(value)).pipe(z.number().finite().min(0).max(100)),
}).strict();
