import { MenuItemKind } from '@prisma/client';
import { z } from 'zod';

export const menuItemSalesFieldsSchema = z.object({
  kind: z.nativeEnum(MenuItemKind).optional(),
  available: z.boolean().optional(),
  includedItemsText: z
    .string()
    .trim()
    .max(500, 'includedItemsText no puede superar 500 caracteres')
    .nullable()
    .optional(),
});

export const menuItemAvailabilitySchema = z.object({
  available: z.boolean(),
}).strict();
