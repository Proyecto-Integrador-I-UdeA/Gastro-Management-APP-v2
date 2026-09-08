import type { Express } from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MenuItemKind, PrismaClient, SalesOrderStatus } from '@prisma/client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createIntegrationToken } from './authToken';

const TEST_SCHEMA = 'sales_02d_api_test';
const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260908160000_sales_02c_tables_orders_foundation/migration.sql',
  ),
  'utf8',
);
const migrationStatements = migrationSql
  .split(';')
  .map(statement => statement.trim())
  .filter(Boolean);

let app: Express;
let prisma: PrismaClient;
let appPrisma: PrismaClient;
let administrationPrisma: PrismaClient;
let originalDatabaseUrl: string;
let actorId: number;
let activeCategoryId: number;
let inactiveCategoryId: number;
let standardItemId: number;
let additionItemId: number;
let unavailableItemId: number;
let inactiveItemId: number;
let inactiveCategoryItemId: number;
let noPriceItemId: number;
let unavailableAdditionId: number;
let usdItemId: number;
let precisionItemAId: number;
let precisionItemBId: number;
let sequence = 0;

function auth(permissions: string[]) {
  return `Bearer ${createIntegrationToken(permissions, actorId)}`;
}

async function createCategory(name: string, active = true) {
  return prisma.menuCategory.create({
    data: {
      name,
      normalizedName: name.toLocaleLowerCase(),
      active,
      displayOrder: 1,
    },
    select: { id: true },
  });
}

async function createMenuItem(
  name: string,
  options: {
    active?: boolean;
    available?: boolean;
    categoryId?: number;
    kind?: MenuItemKind;
  } = {},
) {
  return prisma.menuItem.create({
    data: {
      name,
      active: options.active ?? true,
      available: options.available ?? true,
      categoryId: options.categoryId ?? activeCategoryId,
      kind: options.kind ?? MenuItemKind.STANDARD,
    },
    select: { id: true },
  });
}

async function createPrice(menuItemId: number, amount: string, currency = 'COP') {
  return prisma.menuItemPrice.create({
    data: {
      menuItemId,
      baseCostSnapshot: '1.0000',
      indirectCostSnapshot: '0.0000',
      totalCostSnapshot: '1.0000',
      marginRate: '0.100000',
      taxRate: '0.000000',
      priceBeforeTax: amount,
      taxAmount: '0.0000',
      calculatedAmount: amount,
      roundingIncrement: '0.01',
      amount,
      currency,
      taxIncluded: true,
      calculationVersion: 'sales-price-v1',
      createdById: actorId,
      validFrom: new Date('2026-09-08T12:00:00.000Z'),
    },
    select: { id: true },
  });
}

async function createTable(active = true, area = 'Salón') {
  sequence += 1;
  return prisma.diningTable.create({
    data: {
      code: `T-${sequence.toString().padStart(3, '0')}`,
      area,
      capacity: 4,
      active,
    },
  });
}

async function openOrder(tableId: number, guestCount?: number) {
  const response = await request(app)
    .post(`/sales/tables/${tableId}/orders`)
    .set('Authorization', auth(['sales.manage']))
    .send(guestCount === undefined ? {} : { guestCount });
  expect(response.status).toBe(201);
  return response.body as { id: number; guestCount: number | null };
}

async function addItem(
  orderId: number,
  body: Record<string, unknown>,
) {
  return request(app)
    .post(`/sales/orders/${orderId}/items`)
    .set('Authorization', auth(['sales.manage']))
    .send(body);
}

async function clearOrders() {
  await prisma.salesOrderItem.deleteMany({ where: { parentItemId: { not: null } } });
  await prisma.salesOrderItem.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.diningTable.deleteMany();
}

async function createBaseSchema(client: PrismaClient) {
  const statements = [
    `CREATE TYPE "MenuItemKind" AS ENUM ('STANDARD', 'ADDITION')`,
    `CREATE TABLE "users" (
      "id" SERIAL PRIMARY KEY,
      "email" TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      "fullName" TEXT,
      "roleId" INTEGER,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "active" BOOLEAN NOT NULL DEFAULT true
    )`,
    `CREATE TABLE "roles" (
      "id" SERIAL PRIMARY KEY,
      "name" TEXT NOT NULL UNIQUE,
      "description" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE "permissions" (
      "id" SERIAL PRIMARY KEY,
      "name" TEXT NOT NULL UNIQUE,
      "description" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE "role_permissions" (
      "id" SERIAL PRIMARY KEY,
      "roleId" INTEGER NOT NULL,
      "permissionId" INTEGER NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE ("roleId", "permissionId")
    )`,
    `CREATE TABLE "menu_categories" (
      "id" SERIAL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "normalizedName" TEXT NOT NULL UNIQUE,
      "description" TEXT,
      "displayOrder" INTEGER NOT NULL DEFAULT 0,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE "MenuItem" (
      "id" SERIAL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "hasDrink" BOOLEAN NOT NULL DEFAULT false,
      "hasDessert" BOOLEAN NOT NULL DEFAULT false,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "kind" "MenuItemKind" NOT NULL DEFAULT 'STANDARD',
      "available" BOOLEAN NOT NULL DEFAULT true,
      "includedItemsText" VARCHAR(500),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "caloriesPerPortion" DOUBLE PRECISION,
      "carbsPerPortion" DOUBLE PRECISION,
      "fatPerPortion" DOUBLE PRECISION,
      "nutritionScore" DOUBLE PRECISION,
      "proteinPerPortion" DOUBLE PRECISION,
      "sodiumPerPortion" DOUBLE PRECISION,
      "sugarPerPortion" DOUBLE PRECISION,
      "totalCost" DECIMAL(10,2),
      "categoryId" INTEGER,
      "imageAssetId" INTEGER UNIQUE
    )`,
    `CREATE TABLE "menu_item_prices" (
      "id" SERIAL PRIMARY KEY,
      "menuItemId" INTEGER NOT NULL,
      "baseCostSnapshot" DECIMAL(14,4) NOT NULL,
      "indirectCostSnapshot" DECIMAL(14,4) NOT NULL,
      "totalCostSnapshot" DECIMAL(14,4) NOT NULL,
      "marginRate" DECIMAL(9,6) NOT NULL,
      "taxRate" DECIMAL(9,6) NOT NULL,
      "priceBeforeTax" DECIMAL(14,4) NOT NULL,
      "taxAmount" DECIMAL(14,4) NOT NULL,
      "calculatedAmount" DECIMAL(14,4) NOT NULL,
      "roundingIncrement" DECIMAL(12,2) NOT NULL,
      "amount" DECIMAL(12,2) NOT NULL,
      "currency" VARCHAR(3) NOT NULL DEFAULT 'COP',
      "taxIncluded" BOOLEAN NOT NULL DEFAULT true,
      "calculationVersion" VARCHAR(32) NOT NULL,
      "createdById" INTEGER NOT NULL,
      "validFrom" TIMESTAMP(3) NOT NULL,
      "validUntil" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ];

  for (const statement of statements) {
    await client.$executeRawUnsafe(statement);
  }
  await client.$executeRaw`
    INSERT INTO "roles" ("name") VALUES ('super'), ('admin')
  `;
}

beforeAll(async () => {
  originalDatabaseUrl = process.env.DATABASE_URL as string;
  const baseUrl = process.env.TEST_DATABASE_URL as string;
  const schemaUrl = new URL(baseUrl);
  schemaUrl.searchParams.set('schema', TEST_SCHEMA);

  administrationPrisma = new PrismaClient({ datasources: { db: { url: baseUrl } } });
  await administrationPrisma.$executeRawUnsafe(`CREATE SCHEMA "${TEST_SCHEMA}"`);

  prisma = new PrismaClient({ datasources: { db: { url: schemaUrl.toString() } } });
  await createBaseSchema(prisma);
  for (const statement of migrationStatements) {
    await prisma.$executeRawUnsafe(statement);
  }

  process.env.DATABASE_URL = schemaUrl.toString();
  app = (await import('../../src/app')).default;
  appPrisma = (await import('../../src/lib/prisma')).default;

  const actor = await prisma.user.create({
    data: {
      email: 'sales-02d-actor@example.test',
      passwordHash: 'not-used-by-test',
      fullName: 'Mesero de prueba',
    },
    select: { id: true },
  });
  actorId = actor.id;
  activeCategoryId = (await createCategory('Platos activos')).id;
  inactiveCategoryId = (await createCategory('Categoría inactiva', false)).id;

  standardItemId = (await createMenuItem('Hamburguesa')).id;
  additionItemId = (await createMenuItem('Queso adicional', {
    kind: MenuItemKind.ADDITION,
  })).id;
  unavailableItemId = (await createMenuItem('Producto agotado', {
    available: false,
  })).id;
  inactiveItemId = (await createMenuItem('Producto inactivo', { active: false })).id;
  inactiveCategoryItemId = (await createMenuItem('Categoría inactiva', {
    categoryId: inactiveCategoryId,
  })).id;
  noPriceItemId = (await createMenuItem('Sin precio')).id;
  unavailableAdditionId = (await createMenuItem('Adición agotada', {
    kind: MenuItemKind.ADDITION,
    available: false,
  })).id;
  usdItemId = (await createMenuItem('Producto USD')).id;
  precisionItemAId = (await createMenuItem('Precisión 0.10')).id;
  precisionItemBId = (await createMenuItem('Precisión 0.20')).id;

  await createPrice(standardItemId, '10.10');
  await createPrice(additionItemId, '2.50');
  await createPrice(unavailableItemId, '3.00');
  await createPrice(inactiveItemId, '4.00');
  await createPrice(inactiveCategoryItemId, '5.00');
  await createPrice(unavailableAdditionId, '1.00');
  await createPrice(usdItemId, '8.00', 'USD');
  await createPrice(precisionItemAId, '0.10');
  await createPrice(precisionItemBId, '0.20');
});

afterEach(clearOrders);

afterAll(async () => {
  await clearOrders();
  await appPrisma.$disconnect();
  await prisma.$disconnect();
  await administrationPrisma.$executeRawUnsafe(`DROP SCHEMA "${TEST_SCHEMA}" CASCADE`);
  await administrationPrisma.$disconnect();
  process.env.DATABASE_URL = originalDatabaseUrl;
});

describe('backend de mesas y pedidos SALES-02D', () => {
  it('separa sales.read de sales.manage y deriva los tres estados de mesa', async () => {
    const available = await createTable(true, 'A');
    const occupied = await createTable(true, 'A');
    const outOfService = await createTable(false, 'B');
    await prisma.salesOrder.create({
      data: {
        diningTableId: occupied.id,
        openedById: actorId,
        billRequestedAt: new Date('2026-09-08T13:00:00.000Z'),
      },
    });

    expect((await request(app).get('/sales/tables')).status).toBe(401);
    expect((await request(app)
      .get('/sales/tables')
      .set('Authorization', auth([]))).status).toBe(403);
    expect((await request(app)
      .get('/sales/tables')
      .set('Authorization', auth(['sales.manage']))).status).toBe(403);

    const response = await request(app)
      .get('/sales/tables')
      .set('Authorization', auth(['sales.read']));

    expect(response.status).toBe(200);
    expect(response.body.tables.map((table: { id: number }) => table.id)).toEqual([
      available.id,
      occupied.id,
      outOfService.id,
    ]);
    expect(response.body.tables).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: available.id, operationalStatus: 'AVAILABLE', activeOrder: null }),
      expect.objectContaining({
        id: occupied.id,
        operationalStatus: 'OCCUPIED',
        activeOrder: expect.objectContaining({ billRequestedAt: expect.any(String) }),
      }),
      expect.objectContaining({
        id: outOfService.id,
        operationalStatus: 'OUT_OF_SERVICE',
        activeOrder: null,
      }),
    ]));
  });

  it('abre una mesa con seguridad concurrente y devuelve la orden activa en conflicto', async () => {
    const inactive = await createTable(false);
    const table = await createTable();

    expect((await request(app)
      .post(`/sales/tables/${table.id}/orders`)
      .set('Authorization', auth(['sales.read']))
      .send({})).status).toBe(403);
    expect((await request(app)
      .post(`/sales/tables/${inactive.id}/orders`)
      .set('Authorization', auth(['sales.manage']))
      .send({})).body.code).toBe('TABLE_OUT_OF_SERVICE');
    expect((await request(app)
      .post('/sales/tables/999999/orders')
      .set('Authorization', auth(['sales.manage']))
      .send({})).body.code).toBe('TABLE_NOT_FOUND');
    expect((await request(app)
      .post(`/sales/tables/${table.id}/orders`)
      .set('Authorization', auth(['sales.manage']))
      .send({ guestCount: 2, openedById: actorId })).status).toBe(400);

    const responses = await Promise.all([
      request(app)
        .post(`/sales/tables/${table.id}/orders`)
        .set('Authorization', auth(['sales.manage']))
        .send({ guestCount: 2 }),
      request(app)
        .post(`/sales/tables/${table.id}/orders`)
        .set('Authorization', auth(['sales.manage']))
        .send({ guestCount: 3 }),
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
    const created = responses.find(response => response.status === 201)!;
    const conflict = responses.find(response => response.status === 409)!;
    expect(conflict.body).toMatchObject({
      code: 'TABLE_ALREADY_OCCUPIED',
      activeOrderId: created.body.id,
    });
    expect(await prisma.salesOrder.count({
      where: { diningTableId: table.id, status: SalesOrderStatus.OPEN },
    })).toBe(1);
  });

  it('recupera la orden activa, actualiza comensales y solicita cuenta idempotentemente', async () => {
    const table = await createTable();
    const emptyTable = await createTable();
    const order = await openOrder(table.id, 4);

    const active = await request(app)
      .get(`/sales/tables/${table.id}/active-order`)
      .set('Authorization', auth(['sales.read']));
    expect(active.status).toBe(200);
    expect(active.body).toMatchObject({ id: order.id, status: 'OPEN', guestCount: 4 });
    expect((await request(app)
      .get(`/sales/tables/${emptyTable.id}/active-order`)
      .set('Authorization', auth(['sales.read']))).body.code).toBe('ACTIVE_ORDER_NOT_FOUND');

    const updatedGuests = await request(app)
      .patch(`/sales/orders/${order.id}/guest-count`)
      .set('Authorization', auth(['sales.manage']))
      .send({ guestCount: null });
    expect(updatedGuests.body.guestCount).toBeNull();
    expect((await request(app)
      .patch(`/sales/orders/${order.id}/guest-count`)
      .set('Authorization', auth(['sales.manage']))
      .send({ guestCount: 0 })).status).toBe(400);

    const firstBillRequest = await request(app)
      .post(`/sales/orders/${order.id}/request-bill`)
      .set('Authorization', auth(['sales.manage']))
      .send({});
    const secondBillRequest = await request(app)
      .post(`/sales/orders/${order.id}/request-bill`)
      .set('Authorization', auth(['sales.manage']))
      .send({});
    expect(firstBillRequest.status).toBe(200);
    expect(firstBillRequest.body.status).toBe('OPEN');
    expect(firstBillRequest.body.billRequestedAt).toEqual(secondBillRequest.body.billRequestedAt);

    const addedAfterBill = await addItem(order.id, {
      menuItemId: standardItemId,
      quantity: 1,
    });
    expect(addedAfterBill.status).toBe(201);

    const detail = await request(app)
      .get(`/sales/orders/${order.id}`)
      .set('Authorization', auth(['sales.read']));
    expect(detail.body).toMatchObject({
      id: order.id,
      status: 'OPEN',
      table: { id: table.id },
      openedBy: { id: actorId, fullName: 'Mesero de prueba' },
    });
    expect(detail.body).not.toHaveProperty('openedById');
  });

  it('crea snapshots y adiciones atómicamente, normaliza indicaciones y calcula totales exactos', async () => {
    const order = await openOrder((await createTable()).id);

    const injected = await addItem(order.id, {
      menuItemId: standardItemId,
      quantity: 1,
      price: '0.01',
      currency: 'USD',
      taxIncluded: false,
      addedById: 999,
      parentItemId: 999,
      status: 'SETTLED',
    });
    expect(injected.status).toBe(400);
    expect(await prisma.salesOrderItem.count({ where: { salesOrderId: order.id } })).toBe(0);

    const response = await addItem(order.id, {
      menuItemId: standardItemId,
      quantity: 2,
      specialInstructions: '  Sin cebolla  ',
      additions: [{
        menuItemId: additionItemId,
        specialInstructions: '  Salsa aparte ',
      }],
    });
    expect(response.status).toBe(201);
    expect(response.body.items[0]).toMatchObject({
      menuItemId: standardItemId,
      name: 'Hamburguesa',
      quantity: 2,
      specialInstructions: 'Sin cebolla',
      unitPrice: '10.10',
      lineSubtotal: '20.20',
      currency: 'COP',
      taxIncluded: true,
      additions: [expect.objectContaining({
        menuItemId: additionItemId,
        name: 'Queso adicional',
        quantity: 2,
        specialInstructions: 'Salsa aparte',
        unitPrice: '2.50',
        lineSubtotal: '5.00',
      })],
    });
    expect(response.body.totals).toEqual({
      subtotal: '25.20',
      total: '25.20',
      currency: 'COP',
    });

    const storedLines = await prisma.salesOrderItem.findMany({
      where: { salesOrderId: order.id },
      orderBy: { id: 'asc' },
    });
    expect(storedLines).toHaveLength(2);
    expect(storedLines.every(line => line.addedById === actorId)).toBe(true);
    expect(storedLines[1].parentItemId).toBe(storedLines[0].id);

    await prisma.menuItem.update({
      where: { id: standardItemId },
      data: { name: 'Hamburguesa renombrada' },
    });
    await prisma.menuItemPrice.updateMany({
      where: { menuItemId: standardItemId, validUntil: null },
      data: {
        amount: '99.99',
        priceBeforeTax: '99.99',
        calculatedAmount: '99.99',
      },
    });
    const snapshotAfterCatalogChange = await request(app)
      .get(`/sales/orders/${order.id}`)
      .set('Authorization', auth(['sales.read']));
    expect(snapshotAfterCatalogChange.body.items[0]).toMatchObject({
      name: 'Hamburguesa',
      unitPrice: '10.10',
    });
    await prisma.menuItem.update({
      where: { id: standardItemId },
      data: { name: 'Hamburguesa' },
    });
    await prisma.menuItemPrice.updateMany({
      where: { menuItemId: standardItemId, validUntil: null },
      data: {
        amount: '10.10',
        priceBeforeTax: '10.10',
        calculatedAmount: '10.10',
      },
    });

    const duplicate = await addItem(order.id, {
      menuItemId: standardItemId,
      quantity: 1,
      specialInstructions: 'Sin tomate',
    });
    expect(duplicate.status).toBe(201);
    expect(duplicate.body.items).toHaveLength(2);
    expect(duplicate.body.totals.total).toBe('35.30');
  });

  it('rechaza productos comercialmente inelegibles y revierte el grupo completo', async () => {
    const order = await openOrder((await createTable()).id);
    const cases = [
      [unavailableItemId, 'MENU_ITEM_UNAVAILABLE'],
      [inactiveItemId, 'MENU_ITEM_NOT_SALEABLE'],
      [inactiveCategoryItemId, 'MENU_ITEM_NOT_SALEABLE'],
      [noPriceItemId, 'MENU_ITEM_PRICE_NOT_FOUND'],
      [additionItemId, 'MENU_ITEM_NOT_SALEABLE'],
    ] as const;

    for (const [menuItemId, code] of cases) {
      const response = await addItem(order.id, { menuItemId, quantity: 1 });
      expect(response.status).toBe(409);
      expect(response.body.code).toBe(code);
    }

    const atomicFailure = await addItem(order.id, {
      menuItemId: standardItemId,
      quantity: 1,
      additions: [
        { menuItemId: additionItemId },
        { menuItemId: unavailableAdditionId },
      ],
    });
    expect(atomicFailure.body.code).toBe('MENU_ITEM_UNAVAILABLE');
    expect(await prisma.salesOrderItem.count({ where: { salesOrderId: order.id } })).toBe(0);

    expect((await addItem(order.id, {
      menuItemId: standardItemId,
      quantity: 0,
    })).status).toBe(400);
    expect((await addItem(order.id, {
      menuItemId: standardItemId,
      quantity: 1,
      specialInstructions: 'x'.repeat(501),
    })).status).toBe(400);
  });

  it('añade y elimina adiciones existentes sin permitir anidación ni cruces de orden', async () => {
    const firstOrder = await openOrder((await createTable()).id);
    const secondOrder = await openOrder((await createTable()).id);
    const created = await addItem(firstOrder.id, {
      menuItemId: standardItemId,
      quantity: 2,
      additions: [{ menuItemId: additionItemId, quantity: 1 }],
    });
    const principalId = created.body.items[0].id as number;
    const firstAdditionId = created.body.items[0].additions[0].id as number;

    const added = await request(app)
      .post(`/sales/orders/${firstOrder.id}/items/${principalId}/additions`)
      .set('Authorization', auth(['sales.manage']))
      .send({ menuItemId: additionItemId });
    expect(added.status).toBe(201);
    expect(added.body.items[0].additions).toHaveLength(2);
    expect(added.body.items[0].additions[1].quantity).toBe(2);

    const nested = await request(app)
      .post(`/sales/orders/${firstOrder.id}/items/${firstAdditionId}/additions`)
      .set('Authorization', auth(['sales.manage']))
      .send({ menuItemId: additionItemId });
    expect(nested.body.code).toBe('NESTED_ADDITION_NOT_ALLOWED');
    expect((await request(app)
      .post(`/sales/orders/${firstOrder.id}/items/${principalId}/additions`)
      .set('Authorization', auth(['sales.manage']))
      .send({ menuItemId: standardItemId })).body.code).toBe('ADDITION_KIND_REQUIRED');
    expect((await request(app)
      .post(`/sales/orders/${secondOrder.id}/items/${principalId}/additions`)
      .set('Authorization', auth(['sales.manage']))
      .send({ menuItemId: additionItemId })).body.code).toBe('ORDER_ITEM_NOT_FOUND');

    const deleteAddition = await request(app)
      .delete(`/sales/orders/${firstOrder.id}/items/${firstAdditionId}`)
      .set('Authorization', auth(['sales.manage']));
    expect(deleteAddition.status).toBe(200);
    expect(deleteAddition.body.items[0].additions).toHaveLength(1);
    expect(deleteAddition.body.items[0].id).toBe(principalId);

    const deletePrincipal = await request(app)
      .delete(`/sales/orders/${firstOrder.id}/items/${principalId}`)
      .set('Authorization', auth(['sales.manage']));
    expect(deletePrincipal.status).toBe(200);
    expect(deletePrincipal.body.items).toEqual([]);
    expect(await prisma.salesOrderItem.count({ where: { salesOrderId: firstOrder.id } })).toBe(0);
  });

  it('actualiza solo cantidad/indicaciones y conserva el snapshot de precio', async () => {
    const order = await openOrder((await createTable()).id);
    const created = await addItem(order.id, {
      menuItemId: standardItemId,
      quantity: 1,
      specialInstructions: 'Original',
    });
    const itemId = created.body.items[0].id as number;

    const updated = await request(app)
      .patch(`/sales/orders/${order.id}/items/${itemId}`)
      .set('Authorization', auth(['sales.manage']))
      .send({ quantity: 3, specialInstructions: '   ' });
    expect(updated.status).toBe(200);
    expect(updated.body.items[0]).toMatchObject({
      quantity: 3,
      specialInstructions: null,
      unitPrice: '10.10',
      lineSubtotal: '30.30',
    });
    expect((await request(app)
      .patch(`/sales/orders/${order.id}/items/${itemId}`)
      .set('Authorization', auth(['sales.manage']))
      .send({ quantity: 0 })).status).toBe(400);
    expect((await request(app)
      .patch(`/sales/orders/${order.id}/items/${itemId}`)
      .set('Authorization', auth(['sales.manage']))
      .send({ menuItemId: precisionItemAId })).status).toBe(400);

    await prisma.salesOrder.update({
      where: { id: order.id },
      data: {
        status: SalesOrderStatus.SETTLED,
        settledAt: new Date(),
        settledById: actorId,
      },
    });
    const closedMutation = await request(app)
      .patch(`/sales/orders/${order.id}/items/${itemId}`)
      .set('Authorization', auth(['sales.manage']))
      .send({ quantity: 2 });
    expect(closedMutation.body.code).toBe('ORDER_NOT_OPEN');
  });

  it('aplica moneda única por orden y evita pérdida de precisión decimal', async () => {
    const currencyOrder = await openOrder((await createTable()).id);
    expect((await addItem(currencyOrder.id, {
      menuItemId: standardItemId,
      quantity: 1,
    })).status).toBe(201);
    const mismatch = await addItem(currencyOrder.id, {
      menuItemId: usdItemId,
      quantity: 1,
    });
    expect(mismatch.status).toBe(409);
    expect(mismatch.body).toMatchObject({
      code: 'ORDER_CURRENCY_MISMATCH',
      currency: 'COP',
    });

    const precisionOrder = await openOrder((await createTable()).id);
    await addItem(precisionOrder.id, { menuItemId: precisionItemAId, quantity: 1 });
    const exact = await addItem(precisionOrder.id, {
      menuItemId: precisionItemBId,
      quantity: 1,
    });
    expect(exact.body.totals).toEqual({
      subtotal: '0.30',
      total: '0.30',
      currency: 'COP',
    });
  });

  it('aplica autenticación y autorización a lectura y mutaciones de líneas', async () => {
    const order = await openOrder((await createTable()).id);
    expect((await request(app).get(`/sales/orders/${order.id}`)).status).toBe(401);
    expect((await request(app)
      .get(`/sales/orders/${order.id}`)
      .set('Authorization', auth(['sales.manage']))).status).toBe(403);
    expect((await request(app)
      .post(`/sales/orders/${order.id}/items`)
      .set('Authorization', auth(['sales.read']))
      .send({ menuItemId: standardItemId, quantity: 1 })).status).toBe(403);
  });
});
