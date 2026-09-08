import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';
import { createIntegrationToken } from './authToken';

const PREFIX = '__sales_02b1__';
const availabilityToken = createIntegrationToken(['menu.availability.manage']);
const salesToken = createIntegrationToken(['sales.read']);

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
  await prisma.menuCategory.deleteMany({
    where: { normalizedName: { startsWith: PREFIX } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
}

async function createFixture() {
  const actor = await prisma.user.create({
    data: {
      email: `${PREFIX}actor@example.test`,
      passwordHash: 'not-used-by-test',
    },
  });
  const category = await prisma.menuCategory.create({
    data: {
      name: `${PREFIX}Platos`,
      normalizedName: `${PREFIX}platos`,
    },
  });
  const menuItem = await prisma.menuItem.create({
    data: {
      name: `${PREFIX}Ajiaco`,
      description: 'Descripción original',
      categoryId: category.id,
      active: true,
      available: true,
    },
  });
  const price = await prisma.menuItemPrice.create({
    data: {
      menuItemId: menuItem.id,
      baseCostSnapshot: '10000.0000',
      indirectCostSnapshot: '2000.0000',
      totalCostSnapshot: '12000.0000',
      marginRate: '0.400000',
      taxRate: '0.190000',
      priceBeforeTax: '20000.0000',
      taxAmount: '3800.0000',
      calculatedAmount: '23800.0000',
      roundingIncrement: '100.00',
      amount: '23800.00',
      currency: 'COP',
      taxIncluded: true,
      calculationVersion: 'sales-price-v1',
      createdById: actor.id,
      validFrom: new Date('2026-09-08T12:00:00.000Z'),
    },
  });

  return { actor, category, menuItem, price };
}

beforeEach(clearFixtures);
afterEach(clearFixtures);
afterAll(async () => {
  await clearFixtures();
  await prisma.$disconnect();
});

describe('PATCH /menu-items/:id/availability', () => {
  it('exige autenticación y el permiso estrecho de disponibilidad', async () => {
    const { menuItem } = await createFixture();
    const path = `/menu-items/${menuItem.id}/availability`;

    expect((await request(app).patch(path).send({ available: false })).status).toBe(401);
    expect((await request(app)
      .patch(path)
      .set('Authorization', `Bearer ${createIntegrationToken([])}`)
      .send({ available: false })).status).toBe(403);
    expect((await request(app)
      .patch(path)
      .set('Authorization', `Bearer ${createIntegrationToken(['menu.manage'])}`)
      .send({ available: false })).status).toBe(403);
  });

  it('cambia true → false y false → true sin modificar campos administrativos', async () => {
    const { category, menuItem, price } = await createFixture();
    const path = `/menu-items/${menuItem.id}/availability`;

    const unavailable = await request(app)
      .patch(path)
      .set('Authorization', `Bearer ${availabilityToken}`)
      .send({ available: false });
    expect(unavailable.status).toBe(200);
    expect(unavailable.body).toEqual({ id: menuItem.id, available: false });

    expect(await prisma.menuItem.findUniqueOrThrow({
      where: { id: menuItem.id },
      select: {
        name: true,
        description: true,
        categoryId: true,
        active: true,
        available: true,
      },
    })).toEqual({
      name: menuItem.name,
      description: menuItem.description,
      categoryId: category.id,
      active: true,
      available: false,
    });
    expect(await prisma.menuItemPrice.findUniqueOrThrow({
      where: { id: price.id },
      select: { amount: true, validUntil: true },
    })).toEqual({ amount: price.amount, validUntil: null });

    const catalog = await request(app)
      .get('/sales/menu-catalog')
      .set('Authorization', `Bearer ${salesToken}`);
    expect(catalog.status).toBe(200);
    expect(catalog.body.categories[0].items[0]).toMatchObject({
      id: menuItem.id,
      available: false,
    });

    const available = await request(app)
      .patch(path)
      .set('Authorization', `Bearer ${availabilityToken}`)
      .send({ available: true });
    expect(available.status).toBe(200);
    expect(available.body).toEqual({ id: menuItem.id, available: true });
  });

  it('rechaza valores inválidos y campos adicionales sin modificar el MenuItem', async () => {
    const { menuItem } = await createFixture();
    const path = `/menu-items/${menuItem.id}/availability`;

    expect((await request(app)
      .patch(path)
      .set('Authorization', `Bearer ${availabilityToken}`)
      .send({ available: 'false' })).status).toBe(400);
    expect((await request(app)
      .patch(path)
      .set('Authorization', `Bearer ${availabilityToken}`)
      .send({ available: false, active: false, name: 'Alterado' })).status).toBe(400);

    expect(await prisma.menuItem.findUniqueOrThrow({
      where: { id: menuItem.id },
      select: { name: true, active: true, available: true },
    })).toEqual({ name: menuItem.name, active: true, available: true });
  });

  it('devuelve 400 para id inválido y 404 para un MenuItem inexistente', async () => {
    expect((await request(app)
      .patch('/menu-items/not-an-id/availability')
      .set('Authorization', `Bearer ${availabilityToken}`)
      .send({ available: false })).status).toBe(400);
    expect((await request(app)
      .patch('/menu-items/2147483000/availability')
      .set('Authorization', `Bearer ${availabilityToken}`)
      .send({ available: false })).status).toBe(404);
  });
});
