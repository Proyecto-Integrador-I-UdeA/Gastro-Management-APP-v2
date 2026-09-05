import { Request, Response } from 'express';
import {
  createMenuCategorySchema,
  listMenuCategoriesQuerySchema,
  updateMenuCategorySchema,
} from '../../schemas/menuCategorySchema';
import {
  createMenuCategory,
  DuplicateMenuCategoryError,
  listMenuCategories,
  MenuCategoryNotFoundError,
  updateMenuCategory,
} from '../../services/menuCategoryService';

function parseCategoryId(rawId: string): number | null {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function handleMenuCategoryError(error: unknown, res: Response) {
  if (error instanceof DuplicateMenuCategoryError) {
    return res.status(409).json({ error: error.message });
  }

  if (error instanceof MenuCategoryNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  console.error('Error procesando categoría de menú:', error);
  return res.status(500).json({ error: 'Error interno procesando categoría de menú' });
}

export const listCategories = async (req: Request, res: Response) => {
  const validation = listMenuCategoriesQuerySchema.safeParse(req.query);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Parámetros de consulta inválidos',
      details: validation.error.issues,
    });
  }

  try {
    const categories = await listMenuCategories(
      validation.data.includeInactive === 'true',
    );
    return res.json(categories);
  } catch (error) {
    return handleMenuCategoryError(error, res);
  }
};

export const createCategory = async (req: Request, res: Response) => {
  const validation = createMenuCategorySchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos de categoría inválidos',
      details: validation.error.issues,
    });
  }

  try {
    const category = await createMenuCategory(validation.data);
    return res.status(201).json(category);
  } catch (error) {
    return handleMenuCategoryError(error, res);
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  const id = parseCategoryId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: 'Id de categoría inválido' });
  }

  const validation = updateMenuCategorySchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos de categoría inválidos',
      details: validation.error.issues,
    });
  }

  try {
    const category = await updateMenuCategory(id, validation.data);
    return res.json(category);
  } catch (error) {
    return handleMenuCategoryError(error, res);
  }
};

