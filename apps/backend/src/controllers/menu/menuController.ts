import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { menuItemCategoryIdSchema } from '../../schemas/menuCategorySchema';
import {
  ensureMenuCategoryExists,
  menuCategorySummarySelect,
  MenuCategoryNotFoundError,
} from '../../services/menuCategoryService';

function validateCategoryId(categoryId: unknown, res: Response) {
  const validation = menuItemCategoryIdSchema.safeParse(categoryId);
  if (!validation.success) {
    res.status(400).json({
      error: 'categoryId debe ser un entero positivo o null',
      details: validation.error.issues,
    });
    return null;
  }

  return { value: validation.data };
}

function handleMenuItemError(error: unknown, res: Response, action: string) {
  if (error instanceof MenuCategoryNotFoundError) {
    return res.status(400).json({ error: 'La categoría indicada no existe' });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'La categoría indicada no existe' });
    }

    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Plato no encontrado' });
    }
  }

  console.error(`Error ${action} plato:`, error);
  return res.status(500).json({ error: `Error ${action} plato` });
}

// CREAR PLATO
export const createMenuItem = async (req: Request, res: Response) => {
  const {
    name,
    description,
    hasDrink,
    hasDessert,
    components,
    categoryId,
    totalCost,
    caloriesPerPortion,
    proteinPerPortion,
    carbsPerPortion,
    fatPerPortion,
    sodiumPerPortion,
    sugarPerPortion,
    nutritionScore,
  } = req.body;

  let validatedCategoryId: number | null | undefined;
  if (categoryId !== undefined) {
    const validation = validateCategoryId(categoryId, res);
    if (!validation) return;
    validatedCategoryId = validation.value;
  }

  const safeComponents = Array.isArray(components) ? components : [];

  try {
    if (typeof validatedCategoryId === 'number') {
      await ensureMenuCategoryExists(validatedCategoryId);
    }

    const newItem = await prisma.menuItem.create({
      data: {
        name,
        description,
        hasDrink,
        hasDessert,
        active: true,
        ...(categoryId !== undefined && { categoryId: validatedCategoryId }),
        totalCost: totalCost ?? null,
        caloriesPerPortion: caloriesPerPortion ?? null,
        proteinPerPortion: proteinPerPortion ?? null,
        carbsPerPortion: carbsPerPortion ?? null,
        fatPerPortion: fatPerPortion ?? null,
        sodiumPerPortion: sodiumPerPortion ?? null,
        sugarPerPortion: sugarPerPortion ?? null,
        nutritionScore: nutritionScore ?? null,
        components: {
          create: safeComponents.map((component: any) => ({
            quantity: Number(component.quantity) || 1,
            ...(component.productId ? { productId: component.productId } : {}),
            ...(component.recipeId ? { recipeId: component.recipeId } : {}),
          })),
        },
      },
      include: {
        category: { select: menuCategorySummarySelect },
        components: true,
      },
    });

    return res.json(newItem);
  } catch (error) {
    return handleMenuItemError(error, res, 'creando');
  }
};

// LISTAR PLATOS
export const listMenuItems = async (_req: Request, res: Response) => {
  try {
    const items = await prisma.menuItem.findMany({
      include: {
        category: { select: menuCategorySummarySelect },
        components: {
          include: {
            product: true,
            recipe: true,
          },
        },
      },
    });

    return res.json(items);
  } catch (error) {
    return handleMenuItemError(error, res, 'listando');
  }
};

// ACTUALIZAR PLATO
export const updateMenuItem = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const {
    name,
    description,
    hasDrink,
    hasDessert,
    active,
    components,
    categoryId,
    totalCost,
    caloriesPerPortion,
    proteinPerPortion,
    carbsPerPortion,
    fatPerPortion,
    sodiumPerPortion,
    sugarPerPortion,
    nutritionScore,
  } = req.body;

  if (components !== undefined && !Array.isArray(components)) {
    return res.status(400).json({ error: 'components debe ser un array' });
  }

  let validatedCategoryId: number | null | undefined;
  if (categoryId !== undefined) {
    const validation = validateCategoryId(categoryId, res);
    if (!validation) return;
    validatedCategoryId = validation.value;
  }

  try {
    if (typeof validatedCategoryId === 'number') {
      await ensureMenuCategoryExists(validatedCategoryId);
    }

    const updated = await prisma.menuItem.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(hasDrink !== undefined && { hasDrink }),
        ...(hasDessert !== undefined && { hasDessert }),
        ...(active !== undefined && { active }),
        ...(categoryId !== undefined && { categoryId: validatedCategoryId }),
        ...(totalCost !== undefined && { totalCost }),
        ...(caloriesPerPortion !== undefined && { caloriesPerPortion }),
        ...(proteinPerPortion !== undefined && { proteinPerPortion }),
        ...(carbsPerPortion !== undefined && { carbsPerPortion }),
        ...(fatPerPortion !== undefined && { fatPerPortion }),
        ...(sodiumPerPortion !== undefined && { sodiumPerPortion }),
        ...(sugarPerPortion !== undefined && { sugarPerPortion }),
        ...(nutritionScore !== undefined && { nutritionScore }),
        ...(components !== undefined && {
          components: {
            deleteMany: {},
            create: components.map((component: any) => ({
              quantity: Number(component.quantity) || 1,
              ...(component.productId ? { productId: component.productId } : {}),
              ...(component.recipeId ? { recipeId: component.recipeId } : {}),
            })),
          },
        }),
      },
      include: {
        category: { select: menuCategorySummarySelect },
        components: true,
      },
    });

    return res.json(updated);
  } catch (error) {
    return handleMenuItemError(error, res, 'actualizando');
  }
};

// OBTENER PLATO POR ID
export const getMenuItemById = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  try {
    const item = await prisma.menuItem.findUnique({
      where: { id },
      include: {
        category: { select: menuCategorySummarySelect },
        components: {
          include: {
            product: true,
            recipe: true,
          },
        },
      },
    });

    if (!item) {
      return res.status(404).json({ error: 'Plato no encontrado' });
    }

    return res.json(item);
  } catch (error) {
    return handleMenuItemError(error, res, 'obteniendo');
  }
};
