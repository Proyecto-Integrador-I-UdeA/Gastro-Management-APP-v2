import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';
import { createIntegrationToken } from './authToken';

const PREFIX = '__menu_sales_01a__';
const emptyToken = createIntegrationToken([]);
const salesToken = createIntegrationToken(['sales.read']);
const menuManageToken = createIntegrationToken(['menu.manage']);
const costsReadToken = createIntegrationToken(['costs.read']);
const costsUpdateToken = createIntegrationToken(['costs.update']);

async function clearFixtures() {
  await prisma.menuItem.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.recipe.deleteMany({ where: { internalCode: { startsWith: PREFIX } } });
  await prisma.operationalCostConfig.deleteMany({ where: { month: { startsWith: PREFIX } } });
}

async function createCostFixtures() {
  const recipe = await prisma.recipe.create({
    data: {
      internalCode: `${PREFIX}recipe`,
      name: `${PREFIX} receta`,
      batchQuantity: 1,
      portions: 1,
    },
  });
  const menuItem = await prisma.menuItem.create({
    data: { name: `${PREFIX} plato` },
  });
  return { menuItem, recipe };
}

beforeEach(clearFixtures);
afterEach(clearFixtures);
afterAll(async () => {
  await clearFixtures();
  await prisma.$disconnect();
});

describe('MENU-SALES-01A: autorización de contratos internos de costos', () => {
  it('protege costos de receta y conserva acceso explícito para menu.manage', async () => {
    const { recipe } = await createCostFixtures();
    const path = `/costs/recipe/${recipe.id}`;

    expect((await request(app).get(path)).status).toBe(401);
    expect((await request(app).get(path)
      .set('Authorization', `Bearer ${emptyToken}`)).status).toBe(403);
    expect((await request(app).get(path)
      .set('Authorization', `Bearer ${salesToken}`)).status).toBe(403);
    expect((await request(app).get(path)
      .set('Authorization', `Bearer ${menuManageToken}`)).status).toBe(200);
    expect((await request(app).get(path)
      .set('Authorization', `Bearer ${costsReadToken}`)).status).toBe(200);
  });

  it('reserva el costo de MenuItem para costs.read', async () => {
    const { menuItem } = await createCostFixtures();
    const path = `/costs/menu-item/${menuItem.id}`;

    expect((await request(app).get(path)).status).toBe(401);
    expect((await request(app).get(path)
      .set('Authorization', `Bearer ${emptyToken}`)).status).toBe(403);
    expect((await request(app).get(path)
      .set('Authorization', `Bearer ${salesToken}`)).status).toBe(403);
    expect((await request(app).get(path)
      .set('Authorization', `Bearer ${menuManageToken}`)).status).toBe(403);
    expect((await request(app).get(path)
      .set('Authorization', `Bearer ${costsReadToken}`)).status).toBe(200);
  });

  it('separa lectura y escritura de costos operacionales', async () => {
    expect((await request(app).get('/costs/others')).status).toBe(401);
    expect((await request(app).get('/costs/others')
      .set('Authorization', `Bearer ${emptyToken}`)).status).toBe(403);
    expect((await request(app).get('/costs/others')
      .set('Authorization', `Bearer ${salesToken}`)).status).toBe(403);
    expect((await request(app).get('/costs/others')
      .set('Authorization', `Bearer ${costsUpdateToken}`)).status).toBe(403);
    expect((await request(app).get('/costs/others')
      .set('Authorization', `Bearer ${costsReadToken}`)).status).toBe(200);

    const payload = {
      month: `${PREFIX}2026-09`,
      fixedCosts: 100,
      variableCosts: 20,
      payroll: 30,
      monthlyProduction: 10,
    };
    expect((await request(app).post('/costs/others').send(payload)).status).toBe(401);
    expect((await request(app).post('/costs/others')
      .set('Authorization', `Bearer ${costsReadToken}`)
      .send(payload)).status).toBe(403);

    const created = await request(app)
      .post('/costs/others')
      .set('Authorization', `Bearer ${costsUpdateToken}`)
      .send(payload);
    expect(created.status).toBe(201);

    const updated = await request(app)
      .put(`/costs/others/${created.body.id}`)
      .set('Authorization', `Bearer ${costsUpdateToken}`)
      .send({ ...payload, fixedCosts: 200 });
    expect(updated.status).toBe(200);
    expect(updated.body.fixedCosts).toBe(200);

    expect((await request(app)
      .delete(`/costs/others/${created.body.id}`)
      .set('Authorization', `Bearer ${costsReadToken}`)).status).toBe(403);
    expect((await request(app)
      .delete(`/costs/others/${created.body.id}`)
      .set('Authorization', `Bearer ${costsUpdateToken}`)).status).toBe(200);
  });

  it('mantiene Sales aislado del contrato administrativo de menú', async () => {
    await createCostFixtures();

    expect((await request(app)
      .get('/sales/menu-catalog')
      .set('Authorization', `Bearer ${salesToken}`)).status).toBe(200);
    expect((await request(app)
      .get('/menu-items')
      .set('Authorization', `Bearer ${salesToken}`)).status).toBe(403);
  });
});
