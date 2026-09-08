import { MenuItemKind, Prisma, PrismaClient } from '@prisma/client';
import prisma from '../../lib/prisma';
import type { MediaStorage } from '../media/mediaStorage';
import { getMediaStorage } from '../media/mediaStorageProvider';

type CatalogPriceRecord = {
  amount: Prisma.Decimal.Value;
  currency: string;
  taxIncluded: boolean;
  validFrom: Date;
  validUntil: Date | null;
};

export type SalesMenuCatalogRecord = {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  kind: MenuItemKind;
  available: boolean;
  includedItemsText: string | null;
  categoryId: number | null;
  category: {
    id: number;
    name: string;
    displayOrder: number;
    active: boolean;
  } | null;
  image: {
    url: string;
    width: number | null;
    height: number | null;
  } | null;
  prices: CatalogPriceRecord[];
};

export type SalesMenuCatalog = {
  categories: Array<{
    id: number;
    name: string;
    displayOrder: number;
    items: Array<{
      id: number;
      name: string;
      description: string | null;
      kind: MenuItemKind;
      available: boolean;
      includedItemsText: string | null;
      category: {
        id: number;
        name: string;
      };
      image: {
        url: string;
        width: number | null;
        height: number | null;
      } | null;
      price: {
        amount: string;
        currency: string;
        taxIncluded: boolean;
        validFrom: string;
      };
    }>;
  }>;
};

export interface SalesMenuCatalogDataSource {
  listSaleableMenuItems(): Promise<SalesMenuCatalogRecord[]>;
}

export class SalesMenuCatalogInconsistencyError extends Error {
  constructor(menuItemId: number) {
    super(`MenuItem ${menuItemId} tiene múltiples precios vigentes`);
    this.name = 'SalesMenuCatalogInconsistencyError';
  }
}

export function createPrismaSalesMenuCatalogDataSource(
  client: PrismaClient = prisma,
  mediaStorage?: MediaStorage,
): SalesMenuCatalogDataSource {
  return {
    async listSaleableMenuItems() {
      const items = await client.menuItem.findMany({
        where: {
          active: true,
          categoryId: { not: null },
          category: { is: { active: true } },
          prices: { some: { validUntil: null } },
        },
        select: {
          id: true,
          name: true,
          description: true,
          active: true,
          kind: true,
          available: true,
          includedItemsText: true,
          categoryId: true,
          category: {
            select: {
              id: true,
              name: true,
              displayOrder: true,
              active: true,
            },
          },
          imageAsset: {
            select: {
              storageKey: true,
              width: true,
              height: true,
            },
          },
          prices: {
            where: { validUntil: null },
            select: {
              amount: true,
              currency: true,
              taxIncluded: true,
              validFrom: true,
              validUntil: true,
            },
          },
        },
      });

      return Promise.all(items.map(async ({ imageAsset, ...item }) => ({
        ...item,
        image: imageAsset
          ? {
              url: await (mediaStorage ?? getMediaStorage()).getUrl(imageAsset.storageKey),
              width: imageAsset.width,
              height: imageAsset.height,
            }
          : null,
      })));
    },
  };
}

function compareName(left: string, right: string): number {
  return left.localeCompare(right, 'es');
}

export function buildSalesMenuCatalog(
  records: readonly SalesMenuCatalogRecord[],
): SalesMenuCatalog {
  const categories = new Map<number, SalesMenuCatalog['categories'][number]>();

  for (const record of records) {
    if (!record.active || record.categoryId === null || !record.category?.active) {
      continue;
    }

    const currentPrices = record.prices.filter(price => price.validUntil === null);
    if (currentPrices.length === 0) continue;
    if (currentPrices.length > 1) {
      throw new SalesMenuCatalogInconsistencyError(record.id);
    }

    const category = categories.get(record.category.id) ?? {
      id: record.category.id,
      name: record.category.name,
      displayOrder: record.category.displayOrder,
      items: [],
    };
    const currentPrice = currentPrices[0];

    category.items.push({
      id: record.id,
      name: record.name,
      description: record.description,
      kind: record.kind,
      available: record.available,
      includedItemsText: record.includedItemsText,
      image: record.image,
      category: {
        id: record.category.id,
        name: record.category.name,
      },
      price: {
        amount: new Prisma.Decimal(currentPrice.amount).toFixed(2),
        currency: currentPrice.currency,
        taxIncluded: currentPrice.taxIncluded,
        validFrom: currentPrice.validFrom.toISOString(),
      },
    });
    categories.set(category.id, category);
  }

  const result = [...categories.values()];
  for (const category of result) {
    category.items.sort((left, right) => (
      compareName(left.name, right.name) || left.id - right.id
    ));
  }
  result.sort((left, right) => (
    left.displayOrder - right.displayOrder
    || compareName(left.name, right.name)
    || left.id - right.id
  ));

  return { categories: result };
}

export async function getSalesMenuCatalog(
  source: SalesMenuCatalogDataSource = createPrismaSalesMenuCatalogDataSource(),
): Promise<SalesMenuCatalog> {
  return buildSalesMenuCatalog(await source.listSaleableMenuItems());
}
