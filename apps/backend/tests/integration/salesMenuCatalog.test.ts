import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';
import { createIntegrationToken } from './authToken';

const PREFIX = '__sales_04a3__';

async function clearFixtures() {
  const menuItems = await prisma.menuItem.findMany({
    where: { name: { startsWith: PREFIX } },
    select: { id: true },
  });
  const menuItemIds = menuItems.map(item => item.id);

  if (menuItemIds.length > 0) {
    await prisma.menuItemPrice.deleteMany({ where: { menuItemId: { in: menuItemIds } } });
    await prisma.menuItemComponent.deleteMany({ where: { menuItemId: { in: menuItemIds } } });
    await prisma.menuItem.deleteMany({ where: { id: { in: menuItemIds } } });
  }

  await prisma.mediaAsset.deleteMany({
    where: { storageKey: { startsWith: `${PREFIX}-` } },
  });

  await prisma.menuCategory.deleteMany({
    where: { normalizedName: { startsWith: PREFIX } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
}

async function createActor() {
  return prisma.user.create({
    data: {
      email: `${PREFIX}actor@example.test`,
      passwordHash: 'not-used-by-test',
      fullName: 'Actor catálogo de ventas',
    },
  });
}

async function createCategory(suffix: string, active = true, displayOrder = 1) {
  return prisma.menuCategory.create({
    data: {
      name: `${PREFIX}${suffix}`,
      normalizedName: `${PREFIX}${suffix.toLocaleLowerCase()}`,
      active,
      displayOrder,
    },
  });
}

async function createMenuItem(
  suffix: string,
  categoryId: number | null,
  active = true,
  salesFields: {
    kind?: 'STANDARD' | 'ADDITION';
    available?: boolean;
    includedItemsText?: string | null;
  } = {},
) {
  return prisma.menuItem.create({
    data: {
      name: `${PREFIX}${suffix}`,
      description: `Descripción ${suffix}`,
      categoryId,
      active,
      ...salesFields,
    },
  });
}

async function createPrice(
  menuItemId: number,
  createdById: number,
  current: boolean,
) {
  const validFrom = new Date('2026-09-06T12:00:00.000Z');
  return prisma.menuItemPrice.create({
    data: {
      menuItemId,
      baseCostSnapshot: '15000.0000',
      indirectCostSnapshot: '5000.0000',
      totalCostSnapshot: '20000.0000',
      marginRate: '0.400000',
      taxRate: '0.190000',
      priceBeforeTax: '33333.3333',
      taxAmount: '6333.3333',
      calculatedAmount: '39666.6666',
      roundingIncrement: '1000.00',
      amount: '40000.00',
      currency: 'COP',
      taxIncluded: true,
      calculationVersion: 'sales-price-v1',
      createdById,
      validFrom,
      validUntil: current ? null : new Date('2026-09-06T13:00:00.000Z'),
    },
  });
}

beforeEach(clearFixtures);
afterEach(clearFixtures);
afterAll(async () => {
  await clearFixtures();
  await prisma.$disconnect();
});

describe('GET /sales/menu-catalog', () => {
  it('aplica autenticación y exclusivamente el permiso sales.read', async () => {
    expect((await request(app).get('/sales/menu-catalog')).status).toBe(401);
    expect((await request(app)
      .get('/sales/menu-catalog')
      .set('Authorization', `Bearer ${createIntegrationToken([])}`)).status).toBe(403);

    const response = await request(app)
      .get('/sales/menu-catalog')
      .set('Authorization', `Bearer ${createIntegrationToken(['sales.read'])}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ categories: [] });
  });

  it('expone solo items vendibles y únicamente su información comercial', async () => {
    const actor = await createActor();
    const activeCategory = await createCategory('Platos', true);
    const inactiveCategory = await createCategory('Oculta', false);
    const visible = await createMenuItem('Ajiaco', activeCategory.id, true, {
      kind: 'ADDITION',
      available: false,
      includedItemsText: 'Incluye salsa de la casa.',
    });
    const inactiveItem = await createMenuItem('Inactivo', activeCategory.id, false);
    const inactiveCategoryItem = await createMenuItem('Categoría inactiva', inactiveCategory.id);
    const uncategorized = await createMenuItem('Sin categoría', null);
    await createMenuItem('Sin precio', activeCategory.id);
    const historicalOnly = await createMenuItem('Solo histórico', activeCategory.id);

    await createPrice(visible.id, actor.id, true);
    await createPrice(inactiveItem.id, actor.id, true);
    await createPrice(inactiveCategoryItem.id, actor.id, true);
    await createPrice(uncategorized.id, actor.id, true);
    await createPrice(historicalOnly.id, actor.id, false);
    const imageAsset = await prisma.mediaAsset.create({
      data: {
        storageKey: `${PREFIX}-11111111-1111-4111-8111-111111111111.png`,
        mimeType: 'image/png',
        byteSize: 100,
        width: 12,
        height: 9,
        checksumSha256: 'a'.repeat(64),
        uploadedById: actor.id,
        status: 'ATTACHED',
        attachedAt: new Date(),
      },
    });
    await prisma.menuItem.update({
      where: { id: visible.id },
      data: { imageAssetId: imageAsset.id },
    });

    const response = await request(app)
      .get('/sales/menu-catalog')
      .set('Authorization', `Bearer ${createIntegrationToken(['sales.read'])}`);

    expect(response.status).toBe(200);
    expect(response.body.categories).toHaveLength(1);
    expect(response.body.categories[0].items).toHaveLength(1);
    const item = response.body.categories[0].items[0];
    expect(item).toMatchObject({
      id: visible.id,
      name: `${PREFIX}Ajiaco`,
      kind: 'ADDITION',
      available: false,
      includedItemsText: 'Incluye salsa de la casa.',
      category: { id: activeCategory.id, name: `${PREFIX}Platos` },
      price: {
        amount: '40000.00',
        currency: 'COP',
        taxIncluded: true,
        validFrom: '2026-09-06T12:00:00.000Z',
      },
    });
    expect(typeof item.price.amount).toBe('string');

    for (const field of [
      'totalCost',
      'image',
      'imageAsset',
      'imageAssetId',
      'components',
      'product',
      'recipe',
      'prices',
      'baseCostSnapshot',
      'indirectCostSnapshot',
      'totalCostSnapshot',
      'marginRate',
      'taxRate',
      'priceBeforeTax',
      'taxAmount',
      'calculatedAmount',
      'roundingIncrement',
      'calculationVersion',
      'createdById',
    ]) {
      expect(item).not.toHaveProperty(field);
      expect(item.price).not.toHaveProperty(field);
    }
  });

  it('devuelve 200 con categories vacío cuando no hay productos vendibles', async () => {
    const response = await request(app)
      .get('/sales/menu-catalog')
      .set('Authorization', `Bearer ${createIntegrationToken(['sales.read'])}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ categories: [] });
  });
});
