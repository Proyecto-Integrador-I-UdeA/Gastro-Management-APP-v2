import { Prisma } from '@prisma/client';

export const currentPublishedMenuItemPriceWhere = {
  validUntil: null,
} satisfies Prisma.MenuItemPriceWhereInput;

export const salesCatalogMenuItemWhere = {
  active: true,
  categoryId: { not: null },
  category: { is: { active: true } },
  prices: { some: currentPublishedMenuItemPriceWhere },
} satisfies Prisma.MenuItemWhereInput;
