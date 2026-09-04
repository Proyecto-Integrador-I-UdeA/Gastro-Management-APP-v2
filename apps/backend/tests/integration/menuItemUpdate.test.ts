import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';

const MENU_ITEM_PREFIX = '__sales_00a_test__';

async function clearMenuFixtures() {
  const menuItems = await prisma.menuItem.findMany({
    where: { name: { startsWith: MENU_ITEM_PREFIX } },
    select: { id: true },
  });
  const menuItemIds = menuItems.map((item) => item.id);

  if (menuItemIds.length > 0) {
    await prisma.menuItemComponent.deleteMany({
      where: { menuItemId: { in: menuItemIds } },
    });
    await prisma.menuItem.deleteMany({
      where: { id: { in: menuItemIds } },
    });
  }
}

async function createMenuItemWithComponent(name: string) {
  return prisma.menuItem.create({
    data: {
      name,
      components: {
        create: { quantity: 1 },
      },
    },
    include: { components: true },
  });
}

beforeEach(clearMenuFixtures);
afterEach(clearMenuFixtures);

afterAll(async () => {
  await clearMenuFixtures();
  await prisma.$disconnect();
});

describe('regresión SALES-00A: actualización parcial de MenuItem', () => {
  it('preserva componentes ausentes y permite eliminarlos con un array vacío', async () => {
    const menuItem = await createMenuItemWithComponent(`${MENU_ITEM_PREFIX}_partial`);
    expect(menuItem.components).toHaveLength(1);

    const partialResponse = await request(app)
      .put(`/menu-items/${menuItem.id}`)
      .send({ description: 'Descripción actualizada' });

    expect(partialResponse.status).toBe(200);
    expect(await prisma.menuItemComponent.count({
      where: { menuItemId: menuItem.id },
    })).toBe(1);

    const clearResponse = await request(app)
      .put(`/menu-items/${menuItem.id}`)
      .send({ components: [] });

    expect(clearResponse.status).toBe(200);
    expect(await prisma.menuItemComponent.count({
      where: { menuItemId: menuItem.id },
    })).toBe(0);
  });

  it('rechaza components inválido sin modificar el plato ni sus componentes', async () => {
    const originalName = `${MENU_ITEM_PREFIX}_invalid`;
    const menuItem = await createMenuItemWithComponent(originalName);

    const response = await request(app)
      .put(`/menu-items/${menuItem.id}`)
      .send({
        name: `${MENU_ITEM_PREFIX}_should_not_change`,
        components: 'invalid',
      });

    expect(response.status).toBe(400);
    expect(await prisma.menuItemComponent.count({
      where: { menuItemId: menuItem.id },
    })).toBe(1);

    const persistedMenuItem = await prisma.menuItem.findUniqueOrThrow({
      where: { id: menuItem.id },
      select: { name: true },
    });
    expect(persistedMenuItem.name).toBe(originalName);
  });
});
