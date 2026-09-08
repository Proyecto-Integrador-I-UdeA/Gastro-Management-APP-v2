import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { menuItemCategoryIdSchema } from '../../schemas/menuCategorySchema';
import {
  menuItemAvailabilitySchema,
  menuItemSalesFieldsSchema,
} from '../../schemas/menuItemSchema';
import {
  ensureMenuCategoryExists,
  menuCategorySummarySelect,
  MenuCategoryNotFoundError,
} from '../../services/menuCategoryService';
import {
  calculateMenuItemBaseCost,
  createPrismaMenuItemCostDataSource,
} from '../../services/pricing/menuItemCostService';
import {
  InvalidCostComponentError,
  MenuItemCostNotFoundError,
  RecipeCostNotFoundError,
  RecipeCycleError,
} from '../../services/pricing/pricingErrors';
import { getMediaStorage, MediaStorageConfigurationError } from '../../services/media/mediaStorageProvider';
import {
  assertMediaAssetAttachable,
  cleanupPendingMediaAsset,
  markMediaAssetAttached,
  markMediaAssetPendingDelete,
  MediaAssetNotFoundError,
  MediaAssetUnavailableError,
} from '../../services/media/menuMediaService';

const menuItemAdministrationSelect = {
  id: true,
  name: true,
  description: true,
  hasDrink: true,
  hasDessert: true,
  active: true,
  kind: true,
  available: true,
  includedItemsText: true,
  createdAt: true,
  caloriesPerPortion: true,
  carbsPerPortion: true,
  fatPerPortion: true,
  nutritionScore: true,
  proteinPerPortion: true,
  sodiumPerPortion: true,
  sugarPerPortion: true,
  categoryId: true,
  category: { select: menuCategorySummarySelect },
  imageAsset: {
    select: {
      id: true,
      storageKey: true,
      width: true,
      height: true,
    },
  },
  components: {
    select: {
      id: true,
      menuItemId: true,
      productId: true,
      recipeId: true,
      quantity: true,
    },
  },
} satisfies Prisma.MenuItemSelect;

type MenuItemAdministrationRecord = Prisma.MenuItemGetPayload<{
  select: typeof menuItemAdministrationSelect;
}>;

class MenuItemNotFoundError extends Error {}

async function toMenuItemAdministrationDto(item: MenuItemAdministrationRecord) {
  const { imageAsset, ...menuItem } = item;
  return {
    ...menuItem,
    image: imageAsset
      ? {
          assetId: imageAsset.id,
          url: await getMediaStorage().getUrl(imageAsset.storageKey),
          width: imageAsset.width,
          height: imageAsset.height,
        }
      : null,
  };
}

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

function validateImageAssetId(imageAssetId: unknown, res: Response) {
  if (imageAssetId === null) return { value: null };
  if (typeof imageAssetId === 'number' && Number.isInteger(imageAssetId) && imageAssetId > 0) {
    return { value: imageAssetId };
  }

  res.status(400).json({ error: 'imageAssetId debe ser un entero positivo o null' });
  return null;
}

function validateSalesFields(
  fields: { kind: unknown; available: unknown; includedItemsText: unknown },
  res: Response,
) {
  const validation = menuItemSalesFieldsSchema.safeParse(fields);
  if (!validation.success) {
    res.status(400).json({
      error: 'Los campos comerciales del plato no son válidos',
      details: validation.error.issues,
    });
    return null;
  }

  return validation.data;
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

  if (error instanceof MenuItemCostNotFoundError || error instanceof RecipeCostNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (error instanceof InvalidCostComponentError || error instanceof RecipeCycleError) {
    return res.status(422).json({ error: error.message });
  }

  if (error instanceof MediaAssetNotFoundError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof MediaAssetUnavailableError) {
    return res.status(409).json({ error: error.message });
  }

  if (error instanceof MenuItemNotFoundError) {
    return res.status(404).json({ error: 'Plato no encontrado' });
  }

  if (error instanceof MediaStorageConfigurationError) {
    return res.status(503).json({ error: 'El almacenamiento de imágenes no está disponible' });
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
    kind,
    available,
    includedItemsText,
    components,
    categoryId,
    imageAssetId,
    caloriesPerPortion,
    proteinPerPortion,
    carbsPerPortion,
    fatPerPortion,
    sodiumPerPortion,
    sugarPerPortion,
    nutritionScore,
  } = req.body;

  const salesFields = validateSalesFields({ kind, available, includedItemsText }, res);
  if (!salesFields) return;

  let validatedCategoryId: number | null | undefined;
  if (categoryId !== undefined) {
    const validation = validateCategoryId(categoryId, res);
    if (!validation) return;
    validatedCategoryId = validation.value;
  }

  let validatedImageAssetId: number | null | undefined;
  if (imageAssetId !== undefined) {
    const validation = validateImageAssetId(imageAssetId, res);
    if (!validation) return;
    validatedImageAssetId = validation.value;
  }

  const safeComponents = Array.isArray(components) ? components : [];

  try {
    if (typeof validatedCategoryId === 'number') {
      await ensureMenuCategoryExists(validatedCategoryId);
    }

    const newItem = await prisma.$transaction(async tx => {
      if (typeof validatedImageAssetId === 'number') {
        await assertMediaAssetAttachable(tx, validatedImageAssetId);
      }

      const created = await tx.menuItem.create({
        data: {
          name,
          description,
          hasDrink,
          hasDessert,
          active: true,
          ...(salesFields.kind !== undefined && { kind: salesFields.kind }),
          ...(salesFields.available !== undefined && { available: salesFields.available }),
          ...(salesFields.includedItemsText !== undefined && {
            includedItemsText: salesFields.includedItemsText,
          }),
          ...(categoryId !== undefined && { categoryId: validatedCategoryId }),
          ...(imageAssetId !== undefined && { imageAssetId: validatedImageAssetId }),
          caloriesPerPortion: caloriesPerPortion ?? null,
          proteinPerPortion: proteinPerPortion ?? null,
          carbsPerPortion: carbsPerPortion ?? null,
          fatPerPortion: fatPerPortion ?? null,
          sodiumPerPortion: sodiumPerPortion ?? null,
          sugarPerPortion: sugarPerPortion ?? null,
          nutritionScore: nutritionScore ?? null,
          components: {
            create: safeComponents.map((component: any) => ({
              quantity: Number(component.quantity ?? 1),
              ...(component.productId ? { productId: component.productId } : {}),
              ...(component.recipeId ? { recipeId: component.recipeId } : {}),
            })),
          },
        },
      });
      if (typeof validatedImageAssetId === 'number') {
        await markMediaAssetAttached(tx, validatedImageAssetId);
      }
      const baseCost = await calculateMenuItemBaseCost(
        created.id,
        createPrismaMenuItemCostDataSource(tx),
      );

      return tx.menuItem.update({
        where: { id: created.id },
        data: { totalCost: baseCost },
        select: menuItemAdministrationSelect,
      });
    });

    return res.json(await toMenuItemAdministrationDto(newItem));
  } catch (error) {
    return handleMenuItemError(error, res, 'creando');
  }
};

// LISTAR PLATOS
export const listMenuItems = async (_req: Request, res: Response) => {
  try {
    const items = await prisma.menuItem.findMany({
      select: menuItemAdministrationSelect,
    });

    return res.json(await Promise.all(items.map(toMenuItemAdministrationDto)));
  } catch (error) {
    return handleMenuItemError(error, res, 'listando');
  }
};

// ACTUALIZAR EXCLUSIVAMENTE LA DISPONIBILIDAD OPERATIVA
export const updateMenuItemAvailability = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'id de MenuItem inválido' });
  }

  const validation = menuItemAvailabilitySchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'La disponibilidad indicada no es válida',
      details: validation.error.issues,
    });
  }

  try {
    const item = await prisma.menuItem.update({
      where: { id },
      data: { available: validation.data.available },
      select: { id: true, available: true },
    });
    return res.json(item);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ error: 'Plato no encontrado' });
    }

    console.error('Error actualizando disponibilidad del plato:', error);
    return res.status(500).json({ error: 'Error actualizando disponibilidad del plato' });
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
    kind,
    available,
    includedItemsText,
    components,
    categoryId,
    imageAssetId,
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

  const salesFields = validateSalesFields({ kind, available, includedItemsText }, res);
  if (!salesFields) return;

  let validatedCategoryId: number | null | undefined;
  if (categoryId !== undefined) {
    const validation = validateCategoryId(categoryId, res);
    if (!validation) return;
    validatedCategoryId = validation.value;
  }

  let validatedImageAssetId: number | null | undefined;
  if (imageAssetId !== undefined) {
    const validation = validateImageAssetId(imageAssetId, res);
    if (!validation) return;
    validatedImageAssetId = validation.value;
  }

  try {
    if (typeof validatedCategoryId === 'number') {
      await ensureMenuCategoryExists(validatedCategoryId);
    }

    const { item: updated, cleanupAssetId } = await prisma.$transaction(async tx => {
      const existing = await tx.menuItem.findUnique({
        where: { id },
        select: { id: true, imageAssetId: true },
      });
      if (!existing) {
        throw new MenuItemNotFoundError();
      }
      if (
        typeof validatedImageAssetId === 'number'
        && validatedImageAssetId !== existing.imageAssetId
      ) {
        await assertMediaAssetAttachable(tx, validatedImageAssetId, id);
      }

      const menuItem = await tx.menuItem.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(hasDrink !== undefined && { hasDrink }),
          ...(hasDessert !== undefined && { hasDessert }),
          ...(active !== undefined && { active }),
          ...(salesFields.kind !== undefined && { kind: salesFields.kind }),
          ...(salesFields.available !== undefined && { available: salesFields.available }),
          ...(salesFields.includedItemsText !== undefined && {
            includedItemsText: salesFields.includedItemsText,
          }),
          ...(categoryId !== undefined && { categoryId: validatedCategoryId }),
          ...(imageAssetId !== undefined && { imageAssetId: validatedImageAssetId }),
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
                quantity: Number(component.quantity ?? 1),
                ...(component.productId ? { productId: component.productId } : {}),
                ...(component.recipeId ? { recipeId: component.recipeId } : {}),
              })),
            },
          }),
        },
        select: menuItemAdministrationSelect,
      });

      if (
        typeof validatedImageAssetId === 'number'
        && validatedImageAssetId !== existing.imageAssetId
      ) {
        await markMediaAssetAttached(tx, validatedImageAssetId);
      }
      const cleanupAssetId = imageAssetId !== undefined
        && existing.imageAssetId !== null
        && existing.imageAssetId !== validatedImageAssetId
        ? existing.imageAssetId
        : null;
      if (cleanupAssetId !== null) {
        await markMediaAssetPendingDelete(tx, cleanupAssetId);
      }

      const baseCost = await calculateMenuItemBaseCost(
        menuItem.id,
        createPrismaMenuItemCostDataSource(tx),
      );
      const item = await tx.menuItem.update({
        where: { id },
        data: { totalCost: baseCost },
        select: menuItemAdministrationSelect,
      });
      return { item, cleanupAssetId };
    });

    if (cleanupAssetId !== null) {
      try {
        await cleanupPendingMediaAsset(cleanupAssetId);
      } catch (cleanupError) {
        console.error('No fue posible completar la limpieza de la imagen anterior:', cleanupError);
      }
    }

    return res.json(await toMenuItemAdministrationDto(updated));
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
      select: menuItemAdministrationSelect,
    });

    if (!item) {
      return res.status(404).json({ error: 'Plato no encontrado' });
    }

    return res.json(await toMenuItemAdministrationDto(item));
  } catch (error) {
    return handleMenuItemError(error, res, 'obteniendo');
  }
};

export const deleteMenuItemImage = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  try {
    const { item, cleanupAssetId } = await prisma.$transaction(async tx => {
      const existing = await tx.menuItem.findUnique({
        where: { id },
        select: { imageAssetId: true },
      });
      if (!existing) {
        throw new MenuItemNotFoundError();
      }

      const item = await tx.menuItem.update({
        where: { id },
        data: { imageAssetId: null },
        select: menuItemAdministrationSelect,
      });
      if (existing.imageAssetId !== null) {
        await markMediaAssetPendingDelete(tx, existing.imageAssetId);
      }
      return { item, cleanupAssetId: existing.imageAssetId };
    });

    if (cleanupAssetId !== null) {
      try {
        await cleanupPendingMediaAsset(cleanupAssetId);
      } catch (cleanupError) {
        console.error('No fue posible completar la limpieza de la imagen eliminada:', cleanupError);
      }
    }

    return res.json(await toMenuItemAdministrationDto(item));
  } catch (error) {
    return handleMenuItemError(error, res, 'eliminando la imagen de');
  }
};
