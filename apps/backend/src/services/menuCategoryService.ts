import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

export const menuCategorySummarySelect = {
  id: true,
  name: true,
  displayOrder: true,
  active: true,
} as const;

export class DuplicateMenuCategoryError extends Error {
  constructor() {
    super('Ya existe una categoría con ese nombre');
    this.name = 'DuplicateMenuCategoryError';
  }
}

export class MenuCategoryNotFoundError extends Error {
  constructor() {
    super('Categoría no encontrada');
    this.name = 'MenuCategoryNotFoundError';
  }
}

export function normalizeMenuCategoryName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

type CreateMenuCategoryInput = {
  name: string;
  description?: string | null;
  displayOrder: number;
  active: boolean;
};

type UpdateMenuCategoryInput = Partial<CreateMenuCategoryInput>;

function translateMenuCategoryWriteError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new DuplicateMenuCategoryError();
    }

    if (error.code === 'P2025') {
      throw new MenuCategoryNotFoundError();
    }
  }

  throw error;
}

export async function listMenuCategories(includeInactive: boolean) {
  return prisma.menuCategory.findMany({
    where: includeInactive ? undefined : { active: true },
    orderBy: [
      { displayOrder: 'asc' },
      { name: 'asc' },
      { id: 'asc' },
    ],
  });
}

export async function createMenuCategory(input: CreateMenuCategoryInput) {
  const name = input.name.trim();

  try {
    return await prisma.menuCategory.create({
      data: {
        ...input,
        name,
        normalizedName: normalizeMenuCategoryName(name),
      },
    });
  } catch (error) {
    return translateMenuCategoryWriteError(error);
  }
}

export async function updateMenuCategory(
  id: number,
  input: UpdateMenuCategoryInput,
) {
  const name = input.name?.trim();

  try {
    return await prisma.menuCategory.update({
      where: { id },
      data: {
        ...input,
        ...(name !== undefined && {
          name,
          normalizedName: normalizeMenuCategoryName(name),
        }),
      },
    });
  } catch (error) {
    return translateMenuCategoryWriteError(error);
  }
}

export async function ensureMenuCategoryExists(categoryId: number): Promise<void> {
  const category = await prisma.menuCategory.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });

  if (!category) {
    throw new MenuCategoryNotFoundError();
  }
}

