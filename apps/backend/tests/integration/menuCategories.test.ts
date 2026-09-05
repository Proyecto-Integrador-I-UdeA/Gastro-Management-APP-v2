import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';
import { createIntegrationToken } from './authToken';

const FIXTURE_PREFIX = '__sales_04a1__';
const readToken = createIntegrationToken(['menu.read']);
const manageToken = createIntegrationToken(['menu.manage']);

async function clearFixtures() {
  const categories = await prisma.menuCategory.findMany({
    where: { name: { startsWith: FIXTURE_PREFIX } },
    select: { id: true },
  });
  const categoryIds = categories.map(category => category.id);
  const menuItems = await prisma.menuItem.findMany({
    where: {
      OR: [
        { name: { startsWith: FIXTURE_PREFIX } },
        ...(categoryIds.length > 0 ? [{ categoryId: { in: categoryIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const menuItemIds = menuItems.map(item => item.id);

  if (menuItemIds.length > 0) {
    await prisma.menuItemComponent.deleteMany({
      where: { menuItemId: { in: menuItemIds } },
    });
    await prisma.menuItem.deleteMany({ where: { id: { in: menuItemIds } } });
  }

  if (categoryIds.length > 0) {
    await prisma.menuCategory.deleteMany({ where: { id: { in: categoryIds } } });
  }
}

async function createCategory(name: string, displayOrder = 0, active = true) {
  const response = await request(app)
    .post('/menu-categories')
    .set('Authorization', `Bearer ${manageToken}`)
    .send({ name, displayOrder, active });

  expect(response.status).toBe(201);
  return response.body as { id: number; name: string };
}

beforeEach(clearFixtures);
afterEach(clearFixtures);

afterAll(async () => {
  await clearFixtures();
  await prisma.$disconnect();
});

describe('autorización del menú', () => {
  it('protege GET /menu-items con menu.read', async () => {
    expect((await request(app).get('/menu-items')).status).toBe(401);
    expect((await request(app)
      .get('/menu-items')
      .set('Authorization', `Bearer ${createIntegrationToken([])}`)).status).toBe(403);

    const response = await request(app)
      .get('/menu-items')
      .set('Authorization', `Bearer ${readToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('protege POST y PUT con menu.manage', async () => {
    const forbiddenCreate = await request(app)
      .post('/menu-items')
      .set('Authorization', `Bearer ${readToken}`)
      .send({ name: `${FIXTURE_PREFIX} forbidden` });
    expect(forbiddenCreate.status).toBe(403);

    const allowedCreate = await request(app)
      .post('/menu-items')
      .set('Authorization', `Bearer ${manageToken}`)
      .send({ name: `${FIXTURE_PREFIX} allowed` });
    expect(allowedCreate.status).toBe(200);

    const forbiddenUpdate = await request(app)
      .put(`/menu-items/${allowedCreate.body.id}`)
      .set('Authorization', `Bearer ${readToken}`)
      .send({ description: 'No permitido' });
    expect(forbiddenUpdate.status).toBe(403);

    const allowedUpdate = await request(app)
      .put(`/menu-items/${allowedCreate.body.id}`)
      .set('Authorization', `Bearer ${manageToken}`)
      .send({ description: 'Permitido' });
    expect(allowedUpdate.status).toBe(200);
    expect(allowedUpdate.body.description).toBe('Permitido');
  });
});

describe('API de categorías de menú', () => {
  it('protege GET /menu-categories con menu.read', async () => {
    expect((await request(app).get('/menu-categories')).status).toBe(401);

    const forbiddenResponse = await request(app)
      .get('/menu-categories')
      .set('Authorization', `Bearer ${manageToken}`);
    expect(forbiddenResponse.status).toBe(403);

    const allowedResponse = await request(app)
      .get('/menu-categories')
      .set('Authorization', `Bearer ${readToken}`);
    expect(allowedResponse.status).toBe(200);
  });

  it('protege POST /menu-categories con menu.manage', async () => {
    const payload = { name: `${FIXTURE_PREFIX} autorización POST` };

    expect((await request(app)
      .post('/menu-categories')
      .send(payload)).status).toBe(401);

    const forbiddenResponse = await request(app)
      .post('/menu-categories')
      .set('Authorization', `Bearer ${readToken}`)
      .send(payload);
    expect(forbiddenResponse.status).toBe(403);

    const allowedResponse = await request(app)
      .post('/menu-categories')
      .set('Authorization', `Bearer ${manageToken}`)
      .send(payload);
    expect(allowedResponse.status).toBe(201);
  });

  it('protege PATCH /menu-categories/:id con menu.manage', async () => {
    const category = await createCategory(`${FIXTURE_PREFIX} autorización PATCH`);
    const payload = { description: 'Actualización autorizada' };

    expect((await request(app)
      .patch(`/menu-categories/${category.id}`)
      .send(payload)).status).toBe(401);

    const forbiddenResponse = await request(app)
      .patch(`/menu-categories/${category.id}`)
      .set('Authorization', `Bearer ${readToken}`)
      .send(payload);
    expect(forbiddenResponse.status).toBe(403);

    const allowedResponse = await request(app)
      .patch(`/menu-categories/${category.id}`)
      .set('Authorization', `Bearer ${manageToken}`)
      .send(payload);
    expect(allowedResponse.status).toBe(200);
    expect(allowedResponse.body.description).toBe(payload.description);
  });

  it('crea, lista y ordena categorías, ocultando inactivas por defecto', async () => {
    const inactive = await createCategory(`${FIXTURE_PREFIX} Inactiva`, 0, false);
    const alpha = await createCategory(`${FIXTURE_PREFIX} Alfa`, 1);
    const zulu = await createCategory(`${FIXTURE_PREFIX} Zulu`, 1);
    const later = await createCategory(`${FIXTURE_PREFIX} Posterior`, 2);

    const activeResponse = await request(app)
      .get('/menu-categories')
      .set('Authorization', `Bearer ${readToken}`);
    expect(activeResponse.status).toBe(200);
    const activeFixtureIds = activeResponse.body
      .filter((category: { name: string }) => category.name.startsWith(FIXTURE_PREFIX))
      .map((category: { id: number }) => category.id);
    expect(activeFixtureIds).toEqual([alpha.id, zulu.id, later.id]);

    const allResponse = await request(app)
      .get('/menu-categories?includeInactive=true')
      .set('Authorization', `Bearer ${readToken}`);
    expect(allResponse.status).toBe(200);
    const allFixtureIds = allResponse.body
      .filter((category: { name: string }) => category.name.startsWith(FIXTURE_PREFIX))
      .map((category: { id: number }) => category.id);
    expect(allFixtureIds).toEqual([inactive.id, alpha.id, zulu.id, later.id]);
  });

  it('actualiza, desactiva y recalcula el nombre normalizado', async () => {
    const category = await createCategory(`${FIXTURE_PREFIX} Original`);

    const response = await request(app)
      .patch(`/menu-categories/${category.id}`)
      .set('Authorization', `Bearer ${manageToken}`)
      .send({
        name: `  ${FIXTURE_PREFIX} Renombrada  `,
        description: 'Categoría actualizada',
        displayOrder: 4,
        active: false,
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      name: `${FIXTURE_PREFIX} Renombrada`,
      normalizedName: `${FIXTURE_PREFIX} renombrada`,
      description: 'Categoría actualizada',
      displayOrder: 4,
      active: false,
    });

    const persisted = await prisma.menuCategory.findUniqueOrThrow({
      where: { id: category.id },
    });
    expect(persisted.normalizedName).toBe(`${FIXTURE_PREFIX} renombrada`);
  });

  it('rechaza duplicados por nombre normalizado con un error controlado', async () => {
    await createCategory(`${FIXTURE_PREFIX} Bebidas`);

    const response = await request(app)
      .post('/menu-categories')
      .set('Authorization', `Bearer ${manageToken}`)
      .send({ name: `  ${FIXTURE_PREFIX.toUpperCase()} BEBIDAS  ` });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Ya existe una categoría con ese nombre');
  });
});

describe('MenuItem y categorías', () => {
  it('crea platos sin categoría y mantiene compatibles los platos legados', async () => {
    const createdResponse = await request(app)
      .post('/menu-items')
      .set('Authorization', `Bearer ${manageToken}`)
      .send({ name: `${FIXTURE_PREFIX} sin categoría` });

    expect(createdResponse.status).toBe(200);
    expect(createdResponse.body).toMatchObject({ categoryId: null, category: null });

    const legacy = await prisma.menuItem.create({
      data: { name: `${FIXTURE_PREFIX} legado` },
    });
    const legacyResponse = await request(app)
      .get(`/menu-items/${legacy.id}`)
      .set('Authorization', `Bearer ${readToken}`);

    expect(legacyResponse.status).toBe(200);
    expect(legacyResponse.body).toMatchObject({ categoryId: null, category: null });
  });

  it('asigna, cambia y quita categoryId sin alterar componentes', async () => {
    const firstCategory = await createCategory(`${FIXTURE_PREFIX} Primera`);
    const secondCategory = await createCategory(`${FIXTURE_PREFIX} Segunda`);
    const menuItem = await prisma.menuItem.create({
      data: {
        name: `${FIXTURE_PREFIX} con componente`,
        components: { create: { quantity: 2 } },
      },
      include: { components: true },
    });
    const originalComponentIds = menuItem.components.map(component => component.id);

    for (const categoryId of [firstCategory.id, secondCategory.id]) {
      const response = await request(app)
        .put(`/menu-items/${menuItem.id}`)
        .set('Authorization', `Bearer ${manageToken}`)
        .send({ categoryId });

      expect(response.status).toBe(200);
      expect(response.body.categoryId).toBe(categoryId);
      expect(response.body.category.id).toBe(categoryId);
      expect(response.body.components.map((component: { id: number }) => component.id))
        .toEqual(originalComponentIds);
    }

    const clearResponse = await request(app)
      .put(`/menu-items/${menuItem.id}`)
      .set('Authorization', `Bearer ${manageToken}`)
      .send({ categoryId: null });
    expect(clearResponse.status).toBe(200);
    expect(clearResponse.body).toMatchObject({ categoryId: null, category: null });
    expect(clearResponse.body.components.map((component: { id: number }) => component.id))
      .toEqual(originalComponentIds);
  });

  it('rechaza de forma controlada un categoryId inexistente', async () => {
    const menuItem = await prisma.menuItem.create({
      data: { name: `${FIXTURE_PREFIX} categoría inexistente` },
    });
    const lastCategory = await prisma.menuCategory.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true },
    });

    const response = await request(app)
      .put(`/menu-items/${menuItem.id}`)
      .set('Authorization', `Bearer ${manageToken}`)
      .send({ categoryId: (lastCategory?.id ?? 0) + 100_000 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('La categoría indicada no existe');
  });
});
