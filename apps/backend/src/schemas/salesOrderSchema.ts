import { z } from 'zod';

const positiveInteger = z.number().int().positive();

const specialInstructions = z
  .string()
  .max(500, 'Las indicaciones no pueden superar 500 caracteres')
  .transform(value => value.trim() || null)
  .nullable()
  .optional();

export const positiveIdParamSchema = z.coerce.number().int().positive();

export const openTableOrderSchema = z.object({
  guestCount: positiveInteger.optional(),
}).strict();

export const orderAdditionInputSchema = z.object({
  menuItemId: positiveInteger,
  quantity: positiveInteger.optional(),
  specialInstructions,
}).strict();

export const addOrderItemSchema = z.object({
  menuItemId: positiveInteger,
  quantity: positiveInteger,
  specialInstructions,
  additions: z.array(orderAdditionInputSchema).optional(),
}).strict();

export const addExistingOrderItemAdditionSchema = orderAdditionInputSchema;

export const updateOrderItemSchema = z.object({
  quantity: positiveInteger.optional(),
  specialInstructions,
}).strict().refine(
  value => value.quantity !== undefined || value.specialInstructions !== undefined,
  'Debe indicar quantity o specialInstructions',
);

export const updateOrderGuestCountSchema = z.object({
  guestCount: positiveInteger.nullable(),
}).strict();

export const emptySalesMutationSchema = z.object({}).strict();

export type AddOrderItemInput = z.infer<typeof addOrderItemSchema>;
export type AddExistingOrderItemAdditionInput = z.infer<
  typeof addExistingOrderItemAdditionSchema
>;
export type UpdateOrderItemInput = z.infer<typeof updateOrderItemSchema>;
