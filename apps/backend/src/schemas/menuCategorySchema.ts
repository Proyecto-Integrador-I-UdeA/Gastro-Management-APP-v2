import { z } from 'zod';

const menuCategoryNameSchema = z
  .string()
  .trim()
  .min(1, 'El nombre de la categoría es obligatorio');

const menuCategoryFields = {
  name: menuCategoryNameSchema,
  description: z.string().nullable().optional(),
  displayOrder: z
    .number()
    .int('displayOrder debe ser un número entero')
    .min(0, 'displayOrder debe ser mayor o igual a 0'),
  active: z.boolean(),
};

export const createMenuCategorySchema = z
  .object({
    name: menuCategoryFields.name,
    description: menuCategoryFields.description,
    displayOrder: menuCategoryFields.displayOrder.optional().default(0),
    active: menuCategoryFields.active.optional().default(true),
  })
  .strict();

export const updateMenuCategorySchema = z
  .object({
    name: menuCategoryFields.name.optional(),
    description: menuCategoryFields.description,
    displayOrder: menuCategoryFields.displayOrder.optional(),
    active: menuCategoryFields.active.optional(),
  })
  .strict();

export const listMenuCategoriesQuerySchema = z.object({
  includeInactive: z.enum(['true', 'false']).optional().default('false'),
});

export const menuItemCategoryIdSchema = z.number().int().positive().nullable();

