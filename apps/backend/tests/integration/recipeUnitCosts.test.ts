import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';
import { createIntegrationToken } from './authToken';

const PREFIX = '__recipe_unit_cost__';
const token = createIntegrationToken([]);

async function clearFixtures() {
  const recipes = await prisma.recipe.findMany({
    where: { name: { startsWith: PREFIX } },
    select: { id: true },
  });
  const recipeIds = recipes.map(recipe => recipe.id);

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

async function createKilogramProduct() {
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

  return prisma.product.create({
    data: {
      internalCode: `${PREFIX}PRODUCT`,
      name: `${PREFIX} pechuga`,
      isIngredient: true,
      presentation: 'Bolsa',
      inputUnit: 'kg',
      inputUnitQuantity: 1,
      unitOfMeasure: 'g',
      unitCost: 18_000,
      minStock: 0,
      maxStock: 100,
      supplierId: supplier.id,
      caloriesPer100g: 165,
      proteinPer100g: 31,
    },
  });
}

beforeEach(clearFixtures);
afterEach(clearFixtures);
afterAll(async () => {
  await clearFixtures();
  await prisma.$disconnect();
});

describe('persistencia de costos de receta en unidad base', () => {
  it('POST persiste RecipeItem y Recipe con el costo convertido', async () => {
    const product = await createKilogramProduct();
    const response = await request(app)
      .post('/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `${PREFIX} receta POST`,
        batchQuantity: 1,
        portions: 1,
        items: [{ itemType: 'product', productId: product.id, quantity: 200 }],
        processes: [],
      });

    expect(response.status).toBe(201);
    const stored = await prisma.recipe.findUniqueOrThrow({
      where: { id: response.body.id },
      include: { items: true },
    });
    expect(stored.totalCost.toFixed(2)).toBe('3600.00');
    expect(stored.items[0].unitCost.toFixed(2)).toBe('18.00');
    expect(stored.items[0].totalCost.toFixed(2)).toBe('3600.00');
  });

  it('PUT recalcula RecipeItem y Recipe con la conversión vigente', async () => {
    const product = await createKilogramProduct();
    const created = await request(app)
      .post('/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `${PREFIX} receta PUT`,
        batchQuantity: 1,
        portions: 1,
        items: [{ itemType: 'product', productId: product.id, quantity: 200 }],
        processes: [],
      });

    const response = await request(app)
      .put(`/recipes/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        portions: 1,
        items: [{ itemType: 'product', productId: product.id, quantity: 500 }],
      });

    expect(response.status).toBe(200);
    const stored = await prisma.recipe.findUniqueOrThrow({
      where: { id: created.body.id },
      include: { items: true },
    });
    expect(stored.totalCost.toFixed(2)).toBe('9000.00');
    expect(stored.items[0].unitCost.toFixed(2)).toBe('18.00');
    expect(stored.items[0].totalCost.toFixed(2)).toBe('9000.00');
  });

  it('mantiene quantity de subreceta como número de porciones', async () => {
    const leaf = await prisma.recipe.create({
      data: {
        internalCode: `${PREFIX}LEAF`,
        name: `${PREFIX} subreceta`,
        batchQuantity: 1,
        portions: 3,
        totalCost: 1200,
      },
    });
    const response = await request(app)
      .post('/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `${PREFIX} receta padre`,
        batchQuantity: 1,
        portions: 1,
        items: [{ itemType: 'recipe', subRecipeId: leaf.id, quantity: 2 }],
        processes: [],
      });

    expect(response.status).toBe(201);
    const stored = await prisma.recipe.findUniqueOrThrow({
      where: { id: response.body.id },
      include: { items: true },
    });
    expect(stored.totalCost.toFixed(2)).toBe('800.00');
    expect(stored.items[0].unitCost.toFixed(2)).toBe('400.00');
    expect(stored.items[0].totalCost.toFixed(2)).toBe('800.00');
  });
});
