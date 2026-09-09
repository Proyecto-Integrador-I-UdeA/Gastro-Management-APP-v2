import { z } from 'zod';

export const kitchenDispatchStatusSchema = z.object({
  status: z.enum(['NEXT', 'PREPARING', 'READY']),
}).strict();

export type KitchenDispatchStatusInput = z.infer<
  typeof kitchenDispatchStatusSchema
>;
