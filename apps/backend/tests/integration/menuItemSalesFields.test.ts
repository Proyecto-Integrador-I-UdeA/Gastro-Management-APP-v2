import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';
import { createIntegrationToken } from './authToken';

const PREFIX = '__menu_sales_01c__';
const manageToken = createIntegrationToken(['menu.manage']);

async function clearFixtures() {
  const items = await prisma.menuItem.findMany({
    where: { name: { startsWith: PREFIX } },
    select: { id: true },
  });
  const ids = items.map(item => item.id);
  if (ids.length > 0) {
    await prisma.menuItemPrice.deleteMany({ where: { menuItemId: { in: ids } } });
    await prisma.menuItemComponent.deleteMany({ where: { menuItemId: { in: ids } } });
    await prisma.menuItem.deleteMany({ where: { id: { in: ids } } });
  }
}

beforeEach(clearFixtures);
afterEach(clearFixtures);
afterAll(async () => {
  await clearFixtures();
  await prisma.$disconnect();
});

describe('campos comerciales y operativos de MenuItem', () => {
  it('crea STANDARD disponible por default y lo devuelve en el DTO administrativo', async () => {
    const response = await request(app)
      .post('/menu-items')
      .set('Authorization', `Bearer ${manageToken}`)
      .send({ name: `${PREFIX}standard default` });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      kind: 'STANDARD',
      available: true,
      includedItemsText: null,
      active: true,
    });
  });

  it('crea ADDITION agotada con acompañamientos administrados explícitamente', async () => {
    const response = await request(app)
      .post('/menu-items')
      .set('Authorization', `Bearer ${manageToken}`)
      .send({
        name: `${PREFIX}addition`,
        kind: 'ADDITION',
        available: false,
        includedItemsText: '  Incluye salsa de la casa.  ',
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      kind: 'ADDITION',
      available: false,
      includedItemsText: 'Incluye salsa de la casa.',
      active: true,
    });
  });

  it('edita kind, disponibilidad e incluidos sin acoplar active y available', async () => {
    const item = await prisma.menuItem.create({
      data: { name: `${PREFIX}partial independence` },
    });

    const unavailable = await request(app)
      .put(`/menu-items/${item.id}`)
      .set('Authorization', `Bearer ${manageToken}`)
      .send({ available: false });
    expect(unavailable.status).toBe(200);
    expect(unavailable.body).toMatchObject({ active: true, available: false });

    const inactive = await request(app)
      .put(`/menu-items/${item.id}`)
      .set('Authorization', `Bearer ${manageToken}`)
      .send({ active: false });
    expect(inactive.status).toBe(200);
    expect(inactive.body).toMatchObject({ active: false, available: false });

    const commercialUpdate = await request(app)
      .put(`/menu-items/${item.id}`)
      .set('Authorization', `Bearer ${manageToken}`)
      .send({ kind: 'ADDITION', includedItemsText: 'Incluye ají.' });
    expect(commercialUpdate.status).toBe(200);
    expect(commercialUpdate.body).toMatchObject({
      kind: 'ADDITION',
      active: false,
      available: false,
      includedItemsText: 'Incluye ají.',
    });
  });

  it.each([
    { kind: 'INVALID' },
    { available: 'false' },
    { includedItemsText: 'x'.repeat(501) },
  ])('rechaza campos no representables sin modificar datos: %j', async payload => {
    const item = await prisma.menuItem.create({
      data: { name: `${PREFIX}invalid ${JSON.stringify(payload).slice(0, 20)}` },
    });

    const response = await request(app)
      .put(`/menu-items/${item.id}`)
      .set('Authorization', `Bearer ${manageToken}`)
      .send({ name: `${PREFIX}should not persist`, ...payload });

    expect(response.status).toBe(400);
    expect(await prisma.menuItem.findUniqueOrThrow({
      where: { id: item.id },
      select: { name: true, kind: true, available: true, includedItemsText: true },
    })).toEqual({
      name: item.name,
      kind: 'STANDARD',
      available: true,
      includedItemsText: null,
    });
  });
});
