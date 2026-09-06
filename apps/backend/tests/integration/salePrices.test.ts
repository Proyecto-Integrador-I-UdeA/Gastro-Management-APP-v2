import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';
import { createIntegrationToken } from './authToken';

const PREFIX = '__sales_04a2__';
const RATE_BODY = { marginRate: '0.400000', taxRate: '0.190000' };

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
    await prisma.menuItemPrice.deleteMany({ where: { menuItemId: { in: menuItemIds } } });
    await prisma.menuItemComponent.deleteMany({ where: { menuItemId: { in: menuItemIds } } });
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
  await prisma.product.deleteMany({ where: { internalCode: { startsWith: PREFIX } } });
  await prisma.supplier.deleteMany({ where: { internalCode: { startsWith: PREFIX } } });
  await prisma.operationalCostConfig.deleteMany({ where: { month: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
}

async function createActor() {
  return prisma.user.create({
    data: {
      email: `${PREFIX}actor@example.test`,
      passwordHash: 'not-used-by-test',
      fullName: 'Actor de precios',
    },
  });
}

async function createProductFixture(unitCost = 10_000) {
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
      internalCode: `${PREFIX}PROD`,
      name: `${PREFIX} producto`,
      presentation: 'Bolsa',
      inputUnit: 'g',
      inputUnitQuantity: 1000,
      minStock: 0,
      maxStock: 100,
      unitCost,
      supplierId: supplier.id,
    },
  });
}

async function createDirectMenuFixture(unitCost = 10_000) {
  const actor = await createActor();
  const product = await createProductFixture(unitCost);
  const menuItem = await prisma.menuItem.create({
    data: {
      name: `${PREFIX} plato directo`,
      components: {
        create: { productId: product.id, quantity: 1000 },
      },
    },
  });
  await prisma.operationalCostConfig.create({
    data: {
      month: `${PREFIX}2026-09`,
      fixedCosts: 7000,
      variableCosts: 2000,
      payroll: 1000,
      monthlyProduction: 2,
    },
  });
  return { actor, product, menuItem };
}

beforeEach(clearFixtures);
afterEach(clearFixtures);
afterAll(async () => {
  await clearFixtures();
  await prisma.$disconnect();
});

describe('autorización de precios de venta', () => {
  it('protege calculate con costs.prices.read', async () => {
    const { menuItem } = await createDirectMenuFixture();
    expect((await request(app)
      .post(`/costs/menu-items/${menuItem.id}/sale-price/calculate`)
      .send(RATE_BODY)).status).toBe(401);
    expect((await request(app)
      .post(`/costs/menu-items/${menuItem.id}/sale-price/calculate`)
      .set('Authorization', `Bearer ${createIntegrationToken([])}`)
      .send(RATE_BODY)).status).toBe(403);

    const response = await request(app)
      .post(`/costs/menu-items/${menuItem.id}/sale-price/calculate`)
      .set('Authorization', `Bearer ${createIntegrationToken(['costs.prices.read'])}`)
      .send(RATE_BODY);
    expect(response.status).toBe(200);
    expect(response.body.pricing.amount).toBe('30000.00');
  });

  it('protege publicación con costs.prices.manage', async () => {
    const { actor, menuItem } = await createDirectMenuFixture();
    expect((await request(app)
      .post(`/costs/menu-items/${menuItem.id}/sale-price`)
      .send(RATE_BODY)).status).toBe(401);
    expect((await request(app)
      .post(`/costs/menu-items/${menuItem.id}/sale-price`)
      .set('Authorization', `Bearer ${createIntegrationToken(['costs.prices.read'])}`)
      .send(RATE_BODY)).status).toBe(403);

    const response = await request(app)
      .post(`/costs/menu-items/${menuItem.id}/sale-price`)
      .set('Authorization', `Bearer ${createIntegrationToken(['costs.prices.manage'], actor.id)}`)
      .send(RATE_BODY);
    expect(response.status).toBe(201);
  });

  it('protege historial con costs.prices.read', async () => {
    const { menuItem } = await createDirectMenuFixture();
    expect((await request(app)
      .get(`/costs/menu-items/${menuItem.id}/sale-prices`)
      .set('Authorization', `Bearer ${createIntegrationToken([])}`)).status).toBe(403);
    expect((await request(app)
      .get(`/costs/menu-items/${menuItem.id}/sale-prices`)
      .set('Authorization', `Bearer ${createIntegrationToken(['costs.prices.read'])}`)).status)
      .toBe(200);
  });
});

describe('publicación versionada de precios', () => {
  it('usa exactamente los mismos snapshots normalizados en preview y publish', async () => {
    const { actor, menuItem } = await createDirectMenuFixture(1.234567);
    const generalCost = await request(app)
      .get(`/costs/menu-item/${menuItem.id}`);
    const preview = await request(app)
      .post(`/costs/menu-items/${menuItem.id}/sale-price/calculate`)
      .set(
        'Authorization',
        `Bearer ${createIntegrationToken(['costs.prices.read'], actor.id)}`,
      )
      .send(RATE_BODY);
    const published = await request(app)
      .post(`/costs/menu-items/${menuItem.id}/sale-price`)
      .set(
        'Authorization',
        `Bearer ${createIntegrationToken(['costs.prices.manage'], actor.id)}`,
      )
      .send(RATE_BODY);

    expect(generalCost.status).toBe(200);
    expect(generalCost.body.baseCost).toBe(1.234567);
    expect(preview.status).toBe(200);
    expect(preview.body.cost).toEqual({
      baseCost: '1.2346',
      indirectCost: '5000.0000',
      totalCost: '5001.2346',
    });
    expect(published.status).toBe(201);
    expect(published.body.cost).toEqual(preview.body.cost);
    expect(published.body.pricing).toEqual(preview.body.pricing);
    expect(published.body.currentPrice).toMatchObject({
      baseCostSnapshot: preview.body.cost.baseCost,
      indirectCostSnapshot: preview.body.cost.indirectCost,
      totalCostSnapshot: preview.body.cost.totalCost,
      marginRate: preview.body.pricing.marginRate,
      taxRate: preview.body.pricing.taxRate,
      priceBeforeTax: preview.body.pricing.priceBeforeTax,
      taxAmount: preview.body.pricing.taxAmount,
      calculatedAmount: preview.body.pricing.calculatedAmount,
      roundingIncrement: preview.body.pricing.roundingIncrement,
      amount: preview.body.pricing.amount,
    });
  });

  it('responde 422 en preview y publish cuando priceBeforeTax excede el schema', async () => {
    const { actor, menuItem } = await createDirectMenuFixture();
    const rates = { marginRate: '0.999999', taxRate: '0' };
    const preview = await request(app)
      .post(`/costs/menu-items/${menuItem.id}/sale-price/calculate`)
      .set(
        'Authorization',
        `Bearer ${createIntegrationToken(['costs.prices.read'], actor.id)}`,
      )
      .send(rates);
    const published = await request(app)
      .post(`/costs/menu-items/${menuItem.id}/sale-price`)
      .set(
        'Authorization',
        `Bearer ${createIntegrationToken(['costs.prices.manage'], actor.id)}`,
      )
      .send(rates);

    expect(preview.status).toBe(422);
    expect(preview.body.error).toContain('priceBeforeTax');
    expect(published.status).toBe(422);
    expect(published.body.error).toContain('priceBeforeTax');
    expect(await prisma.menuItemPrice.count({ where: { menuItemId: menuItem.id } })).toBe(0);
  });

  it('mantiene el costo general sin límite de pricing y rechaza sus snapshots con 422', async () => {
    const { actor, menuItem } = await createDirectMenuFixture(10_000_000_000.25);
    const generalCost = await request(app)
      .get(`/costs/menu-item/${menuItem.id}`);
    const preview = await request(app)
      .post(`/costs/menu-items/${menuItem.id}/sale-price/calculate`)
      .set(
        'Authorization',
        `Bearer ${createIntegrationToken(['costs.prices.read'], actor.id)}`,
      )
      .send({ marginRate: '0', taxRate: '0' });
    const published = await request(app)
      .post(`/costs/menu-items/${menuItem.id}/sale-price`)
      .set(
        'Authorization',
        `Bearer ${createIntegrationToken(['costs.prices.manage'], actor.id)}`,
      )
      .send({ marginRate: '0', taxRate: '0' });

    expect(generalCost.status).toBe(200);
    expect(generalCost.body.baseCost).toBeGreaterThan(9_999_999_999.9999);
    expect(preview.status).toBe(422);
    expect(preview.body.error).toContain('baseCostSnapshot');
    expect(published.status).toBe(422);
    expect(published.body.error).toContain('baseCostSnapshot');
    expect(await prisma.menuItemPrice.count({ where: { menuItemId: menuItem.id } })).toBe(0);
  });

  it('recalcula snapshots, identifica actor y cierra exactamente la versión anterior', async () => {
    const { actor, product, menuItem } = await createDirectMenuFixture();
    const manageToken = createIntegrationToken(['costs.prices.manage'], actor.id);
    const readToken = createIntegrationToken(['costs.prices.read'], actor.id);

    const firstResponse = await request(app)
      .post(`/costs/menu-items/${menuItem.id}/sale-price`)
      .set('Authorization', `Bearer ${manageToken}`)
      .send(RATE_BODY);
    expect(firstResponse.status).toBe(201);
    expect(firstResponse.body).toMatchObject({
      cost: {
        baseCost: '10000.0000',
        indirectCost: '5000.0000',
        totalCost: '15000.0000',
      },
      pricing: { amount: '30000.00' },
      currentPrice: {
        createdById: actor.id,
        amount: '30000.00',
        validUntil: null,
      },
    });

    await prisma.product.update({ where: { id: product.id }, data: { unitCost: 12_000 } });

    const previewResponse = await request(app)
      .post(`/costs/menu-items/${menuItem.id}/sale-price/calculate`)
      .set('Authorization', `Bearer ${readToken}`)
      .send(RATE_BODY);
    expect(previewResponse.status).toBe(200);
    expect(previewResponse.body.cost.totalCost).toBe('17000.0000');
    expect(previewResponse.body.pricing.amount).toBe('34000.00');
    expect(previewResponse.body.currentPrice.amount).toBe('30000.00');

    const firstBeforeSecondPublish = await prisma.menuItemPrice.findUniqueOrThrow({
      where: { id: firstResponse.body.currentPrice.id },
    });
    expect(firstBeforeSecondPublish.validUntil).toBeNull();

    const secondResponse = await request(app)
      .post(`/costs/menu-items/${menuItem.id}/sale-price`)
      .set('Authorization', `Bearer ${manageToken}`)
      .send(RATE_BODY);
    expect(secondResponse.status).toBe(201);
    expect(secondResponse.body.currentPrice.amount).toBe('34000.00');

    const prices = await prisma.menuItemPrice.findMany({
      where: { menuItemId: menuItem.id },
      orderBy: { validFrom: 'asc' },
    });
    expect(prices).toHaveLength(2);
    expect(prices.filter(price => price.validUntil === null)).toHaveLength(1);
    expect(prices[0].validUntil?.getTime()).toBe(prices[1].validFrom.getTime());
    expect(prices[0].amount.toFixed(2)).toBe('30000.00');

    const historyResponse = await request(app)
      .get(`/costs/menu-items/${menuItem.id}/sale-prices`)
      .set('Authorization', `Bearer ${readToken}`);
    expect(historyResponse.body[0].validUntil).toBeNull();
    expect(historyResponse.body[1].id).toBe(prices[0].id);

    const closedPriceSnapshot = await prisma.menuItemPrice.findUniqueOrThrow({
      where: { id: prices[0].id },
    });
    const thirdResponse = await request(app)
      .post(`/costs/menu-items/${menuItem.id}/sale-price`)
      .set('Authorization', `Bearer ${manageToken}`)
      .send({ marginRate: '0.300000', taxRate: '0.100000' });
    expect(thirdResponse.status).toBe(201);

    const closedPriceAfterThirdPublish = await prisma.menuItemPrice.findUniqueOrThrow({
      where: { id: prices[0].id },
    });
    expect(closedPriceAfterThirdPublish).toEqual(closedPriceSnapshot);
  });

  it.each([
    { amount: '1.00' },
    { createdById: 123 },
    { validFrom: new Date().toISOString() },
  ])('rechaza campos calculados o de auditoría: %j', async extraField => {
    const { actor, menuItem } = await createDirectMenuFixture();
    const response = await request(app)
      .post(`/costs/menu-items/${menuItem.id}/sale-price`)
      .set('Authorization', `Bearer ${createIntegrationToken(['costs.prices.manage'], actor.id)}`)
      .send({ ...RATE_BODY, ...extraField });

    expect(response.status).toBe(400);
    expect(await prisma.menuItemPrice.count({ where: { menuItemId: menuItem.id } })).toBe(0);
  });

  it.each([
    { marginRate: '0.1234567', taxRate: '0.190000' },
    { marginRate: '0.400000', taxRate: '0.1234567' },
    { marginRate: '0.9999999', taxRate: '0.190000' },
  ])(
    'rechaza tasas con más de seis decimales sin publicar: %o',
    async rates => {
      const { actor, menuItem } = await createDirectMenuFixture();
      const response = await request(app)
        .post(`/costs/menu-items/${menuItem.id}/sale-price`)
        .set(
          'Authorization',
          `Bearer ${createIntegrationToken(['costs.prices.manage'], actor.id)}`,
        )
        .send(rates);

      expect(response.status).toBe(400);
      expect(await prisma.menuItemPrice.count({ where: { menuItemId: menuItem.id } })).toBe(0);
    },
  );

  it('serializa dos publicaciones concurrentes y deja una sola versión abierta', async () => {
    const { actor, menuItem } = await createDirectMenuFixture();
    const token = createIntegrationToken(['costs.prices.manage'], actor.id);

    const responses = await Promise.all([
      request(app)
        .post(`/costs/menu-items/${menuItem.id}/sale-price`)
        .set('Authorization', `Bearer ${token}`)
        .send(RATE_BODY),
      request(app)
        .post(`/costs/menu-items/${menuItem.id}/sale-price`)
        .set('Authorization', `Bearer ${token}`)
        .send({ marginRate: '0.350000', taxRate: '0.190000' }),
    ]);

    expect(responses.map(response => response.status).sort()).toEqual([201, 201]);
    expect(await prisma.menuItemPrice.count({ where: { menuItemId: menuItem.id } })).toBe(2);
    expect(await prisma.menuItemPrice.count({
      where: { menuItemId: menuItem.id, validUntil: null },
    })).toBe(1);
  });
});

describe('costos recursivos en la API oficial', () => {
  it('calcula una subreceta mediante el endpoint de preview', async () => {
    const product = await createProductFixture(100);
    const leaf = await prisma.recipe.create({
      data: {
        internalCode: `${PREFIX}RECIPE_LEAF`,
        name: `${PREFIX} receta hoja`,
        batchQuantity: 1,
        portions: 2,
      },
    });
    const parent = await prisma.recipe.create({
      data: {
        internalCode: `${PREFIX}RECIPE_PARENT`,
        name: `${PREFIX} receta padre`,
        batchQuantity: 1,
        portions: 1,
      },
    });
    await prisma.recipeItem.create({
      data: {
        recipeId: leaf.id,
        productId: product.id,
        quantity: 1000,
        unitCost: 0,
        totalCost: 0,
      },
    });
    await prisma.recipeItem.create({
      data: {
        recipeId: parent.id,
        subRecipeId: leaf.id,
        quantity: 2,
        unitCost: 0,
        totalCost: 0,
      },
    });
    const menuItem = await prisma.menuItem.create({
      data: {
        name: `${PREFIX} plato subreceta`,
        components: { create: { recipeId: parent.id, quantity: 1 } },
      },
    });

    const response = await request(app)
      .post(`/costs/menu-items/${menuItem.id}/sale-price/calculate`)
      .set('Authorization', `Bearer ${createIntegrationToken(['costs.prices.read'])}`)
      .send({ marginRate: '0', taxRate: '0' });

    expect(response.status).toBe(200);
    expect(response.body.cost.baseCost).toBe('100.0000');
  });

  it('devuelve error controlado ante un ciclo de recetas', async () => {
    const first = await prisma.recipe.create({
      data: {
        internalCode: `${PREFIX}RECIPE_CYCLE_A`,
        name: `${PREFIX} ciclo A`,
        batchQuantity: 1,
        portions: 1,
      },
    });
    const second = await prisma.recipe.create({
      data: {
        internalCode: `${PREFIX}RECIPE_CYCLE_B`,
        name: `${PREFIX} ciclo B`,
        batchQuantity: 1,
        portions: 1,
      },
    });
    await prisma.recipeItem.createMany({
      data: [
        { recipeId: first.id, subRecipeId: second.id, quantity: 1, unitCost: 0, totalCost: 0 },
        { recipeId: second.id, subRecipeId: first.id, quantity: 1, unitCost: 0, totalCost: 0 },
      ],
    });
    const menuItem = await prisma.menuItem.create({
      data: {
        name: `${PREFIX} plato cíclico`,
        components: { create: { recipeId: first.id, quantity: 1 } },
      },
    });

    const response = await request(app)
      .post(`/costs/menu-items/${menuItem.id}/sale-price/calculate`)
      .set('Authorization', `Bearer ${createIntegrationToken(['costs.prices.read'])}`)
      .send(RATE_BODY);

    expect(response.status).toBe(422);
    expect(response.body.error).toContain('ciclo de recetas');
  });
});
