import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';
import { createIntegrationToken } from './authToken';

const PREFIX = '__menu_authoritative_cost__';
const manageToken = createIntegrationToken(['menu.manage']);
const readToken = createIntegrationToken(['menu.read']);

async function clearFixtures() {
  const menuItems = await prisma.menuItem.findMany({
    where: { name: { startsWith: PREFIX } },
    select: { id: true },
  });
  const menuItemIds = menuItems.map(item => item.id);
  const recipes = await prisma.recipe.findMany({
    where: { internalCode: { startsWith: PREFIX } },
    select: { id: true },
  });
  const recipeIds = recipes.map(recipe => recipe.id);

  if (menuItemIds.length > 0) {
    await prisma.menuItemComponent.deleteMany({
      where: { menuItemId: { in: menuItemIds } },
    });
    await prisma.menuItem.deleteMany({ where: { id: { in: menuItemIds } } });
  }
  if (recipeIds.length > 0) {
    await prisma.recipeItem.deleteMany({
      where: {
        OR: [
          { recipeId: { in: recipeIds } },
          { subRecipeId: { in: recipeIds } },
        ],
      },
    });
    await prisma.recipe.deleteMany({ where: { id: { in: recipeIds } } });
  }
  await prisma.product.deleteMany({
    where: { internalCode: { startsWith: PREFIX } },
  });
  await prisma.supplier.deleteMany({
    where: { internalCode: { startsWith: PREFIX } },
  });
}

async function createRecipeWithHistoricalCost() {
  const supplier = await prisma.supplier.create({
    data: {
      internalCode: `${PREFIX}SUP`,
      name: `${PREFIX} proveedor`,
      taxId: `${PREFIX}NIT`,
      phone: '0000000',
      address: 'Dirección de prueba',
      contactPerson: 'Contacto de prueba',
    },
  });
  const product = await prisma.product.create({
    data: {
      internalCode: `${PREFIX}PROD`,
      name: `${PREFIX} pechuga`,
      presentation: 'Bolsa',
      inputUnit: 'kg',
      inputUnitQuantity: 1,
      unitOfMeasure: 'g',
      minStock: 0,
      maxStock: 100,
      unitCost: 18_000,
      supplierId: supplier.id,
    },
  });

  const recipe = await prisma.recipe.create({
    data: {
      internalCode: `${PREFIX}RECIPE`,
      name: `${PREFIX} receta`,
      batchQuantity: 1,
      portions: 2,
      totalCost: 3_600_000,
      items: {
        create: {
          productId: product.id,
          quantity: 200,
          unitCost: 18_000,
          totalCost: 3_600_000,
        },
      },
    },
  });

  return { product, recipe };
}

beforeEach(clearFixtures);
afterEach(clearFixtures);

afterAll(async () => {
  await clearFixtures();
  await prisma.$disconnect();
});

describe('costo autoritativo al escribir MenuItem', () => {
  it('ignora totalCost del cliente y recalcula al crear y actualizar', async () => {
    const { product, recipe } = await createRecipeWithHistoricalCost();

    const recipeCost = await request(app)
      .get(`/costs/recipe/${recipe.id}`)
      .set('Authorization', `Bearer ${manageToken}`);
    expect(recipeCost.status).toBe(200);
    expect(recipeCost.body).toMatchObject({
      totalCost: 3600,
      costPerPortion: 1800,
    });

    const created = await request(app)
      .post('/menu-items')
      .set('Authorization', `Bearer ${manageToken}`)
      .send({
        name: `${PREFIX} plato`,
        totalCost: 999_999_999,
        components: [{ recipeId: recipe.id, quantity: 2 }],
      });

    expect(created.status).toBe(200);
    expect(created.body).not.toHaveProperty('totalCost');
    expect(Number((await prisma.menuItem.findUniqueOrThrow({
      where: { id: created.body.id },
    })).totalCost)).toBe(3600);

    const fetchedRecipeComponent = await request(app)
      .get(`/menu-items/${created.body.id}`)
      .set('Authorization', `Bearer ${readToken}`);
    expect(fetchedRecipeComponent.status).toBe(200);
    expect(fetchedRecipeComponent.body).not.toHaveProperty('totalCost');
    expect(fetchedRecipeComponent.body.components[0]).not.toHaveProperty('recipe');

    const updated = await request(app)
      .put(`/menu-items/${created.body.id}`)
      .set('Authorization', `Bearer ${manageToken}`)
      .send({
        totalCost: 1,
        components: [{ recipeId: recipe.id, quantity: 3 }],
      });

    expect(updated.status).toBe(200);
    expect(updated.body).not.toHaveProperty('totalCost');
    expect(Number((await prisma.menuItem.findUniqueOrThrow({
      where: { id: created.body.id },
    })).totalCost)).toBe(5400);

    const forgedUpdate = await request(app)
      .put(`/menu-items/${created.body.id}`)
      .set('Authorization', `Bearer ${manageToken}`)
      .send({ totalCost: 1 });

    expect(forgedUpdate.status).toBe(200);
    expect(forgedUpdate.body).not.toHaveProperty('totalCost');
    expect(Number((await prisma.menuItem.findUniqueOrThrow({
      where: { id: created.body.id },
    })).totalCost)).toBe(5400);

    const productMenuItem = await prisma.menuItem.create({
      data: {
        name: `${PREFIX} producto directo`,
        totalCost: 999_999,
        components: {
          create: { productId: product.id, quantity: 200 },
        },
      },
    });
    const fetchedProductComponent = await request(app)
      .get(`/menu-items/${productMenuItem.id}`)
      .set('Authorization', `Bearer ${readToken}`);
    expect(fetchedProductComponent.status).toBe(200);
    expect(fetchedProductComponent.body).not.toHaveProperty('totalCost');
    expect(fetchedProductComponent.body.components[0]).not.toHaveProperty('product');
  });
});
