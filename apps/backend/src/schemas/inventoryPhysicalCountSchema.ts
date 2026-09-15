import { z } from 'zod';

export const physicalCountReasonSchema = z.enum([
  'PHYSICAL_COUNT',
  'UNRECORDED_ENTRY',
  'WASTE_OR_YIELD_VARIANCE',
  'DAMAGE_OR_LOSS',
  'DATA_CORRECTION',
  'OTHER',
]);

const itemSchema = z.object({
  productId: z.number().int().positive(),
  countedQuantity: z.number().finite().min(0).nullable(),
}).strict();

export const createPhysicalCountSchema = z.object({
  warehouseId: z.number().int().positive(),
  reason: physicalCountReasonSchema.default('PHYSICAL_COUNT'),
  notes: z.string().trim().max(1000).nullable().optional(),
  items: z.array(itemSchema).max(500).default([]),
}).strict();

export const updatePhysicalCountSchema = z.object({
  reason: physicalCountReasonSchema.optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  items: z.array(itemSchema).max(500).optional(),
}).strict().refine(value => Object.keys(value).length > 0, {
  message: 'Debe enviar al menos un campo',
});

export const listPhysicalCountsQuerySchema = z.object({
  warehouseId: z.coerce.number().int().positive().optional(),
  status: z.enum(['DRAFT', 'POSTED', 'CANCELLED']).optional(),
}).strict();

export const inventoryCountReferencesQuerySchema = z.object({
  warehouseId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(100).optional(),
}).strict();

export type PhysicalCountWriteInput = z.infer<typeof createPhysicalCountSchema>;
