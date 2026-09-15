import type { Express } from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createIntegrationToken } from './authToken';

const SCHEMA = 'inventory_01a_api_test';
let app: Express; let prisma: PrismaClient; let admin: PrismaClient; let originalUrl: string;
const readToken = `Bearer ${createIntegrationToken(['inventory.read'], 1)}`;
const writeToken = `Bearer ${createIntegrationToken(['inventory.read', 'inventory.create'], 1)}`;

async function createCount(items: Array<{ productId: number; countedQuantity: number | null }>) {
  return request(app).post('/inventory-counts').set('Authorization', writeToken).send({ warehouseId: 1, reason: 'PHYSICAL_COUNT', notes: 'Conteo de prueba', items });
}

beforeAll(async () => {
  originalUrl = process.env.DATABASE_URL as string;
  const base = process.env.TEST_DATABASE_URL as string;
  const url = new URL(base); url.searchParams.set('schema', SCHEMA);
  admin = new PrismaClient({ datasources: { db: { url: base } } });
  await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${SCHEMA}"`);
  prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  for (const sql of [
    `CREATE TYPE "MovementType" AS ENUM ('PURCHASE','TRANSFER','WASTE','CONSUMPTION')`,
    `CREATE TYPE "ProductBaseUnit" AS ENUM ('g','ml','und')`,
    `CREATE TABLE "users" ("id" SERIAL PRIMARY KEY,"email" TEXT NOT NULL UNIQUE,"passwordHash" TEXT NOT NULL,"fullName" TEXT,"roleId" INTEGER,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"active" BOOLEAN DEFAULT true)`,
    `CREATE TABLE "warehouses" ("id" SERIAL PRIMARY KEY,"name" TEXT NOT NULL UNIQUE,"description" TEXT,"isMain" BOOLEAN DEFAULT false,"active" BOOLEAN DEFAULT true,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE "products" ("id" SERIAL PRIMARY KEY,"internalCode" TEXT NOT NULL UNIQUE,"name" TEXT NOT NULL,"category" TEXT DEFAULT '',"isIngredient" BOOLEAN DEFAULT true,"isSupply" BOOLEAN DEFAULT false,"isFinishedProduct" BOOLEAN DEFAULT false,"presentation" TEXT NOT NULL,"inputUnit" TEXT NOT NULL,"inputUnitQuantity" DOUBLE PRECISION NOT NULL,"minStock" DOUBLE PRECISION NOT NULL,"maxStock" DOUBLE PRECISION NOT NULL,"currentStock" DOUBLE PRECISION DEFAULT 0,"unitCost" DOUBLE PRECISION NOT NULL,"active" BOOLEAN DEFAULT true,"supplierId" INTEGER NOT NULL,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"unitOfMeasure" "ProductBaseUnit" NOT NULL)`,
    `CREATE TABLE "inventories" ("id" SERIAL PRIMARY KEY,"quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,"productId" INTEGER NOT NULL,"warehouseId" INTEGER NOT NULL,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,UNIQUE("productId","warehouseId"))`,
    `CREATE TABLE "inventory_movements" ("id" SERIAL PRIMARY KEY,"type" "MovementType" NOT NULL,"quantity" DOUBLE PRECISION NOT NULL,"unitCost" DECIMAL(10,2),"expirationDate" TIMESTAMP(3),"notes" TEXT,"productId" INTEGER NOT NULL,"sourceWarehouseId" INTEGER,"destinationWarehouseId" INTEGER,"userId" INTEGER NOT NULL,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)`,
  ]) await prisma.$executeRawUnsafe(sql);
  const migration = readFileSync(resolve(process.cwd(), 'prisma/migrations/20260915120000_inventory_01a_physical_counts/migration.sql'), 'utf8');
  for (const sql of migration.split(';').map(part => part.trim()).filter(Boolean)) await prisma.$executeRawUnsafe(sql);
  const warehouseMigration = readFileSync(resolve(process.cwd(), 'prisma/migrations/20260915170000_operational_warehouse_routing/migration.sql'), 'utf8');
  for (const sql of warehouseMigration.split(';').map(part => part.trim()).filter(Boolean)) await prisma.$executeRawUnsafe(sql);
  await prisma.$executeRaw`INSERT INTO "users" ("id","email","passwordHash","fullName") VALUES (1,'inventory@test.local','x','Responsable Inventario')`;
  await prisma.$executeRaw`INSERT INTO "warehouses" ("id","name","isMain","active") VALUES (1,'Bodega de prueba',true,true),(2,'Inactiva',false,false)`;
  await prisma.$executeRaw`
    INSERT INTO "products" ("id","internalCode","name","presentation","inputUnit","inputUnitQuantity","minStock","maxStock","unitCost","supplierId","unitOfMeasure") VALUES
    (1,'P1','Pollo','Bolsa', 'kg',1,0,100,18000,1,'g'),
    (2,'P2','Aguacate','Bolsa','kg',1,0,100,10000,1,'g'),
    (3,'P3','Queso','Bolsa','kg',1,0,100,12000,1,'g'),
    (4,'P4','Producto nuevo','Bolsa','kg',1,0,100,4000,1,'g')
  `;
  await prisma.$executeRaw`INSERT INTO "inventories" ("productId","warehouseId","quantity") VALUES (1,1,10),(2,1,-0.12),(3,1,5)`;
  process.env.DATABASE_URL = url.toString();
  app = (await import('../../src/app')).default;
}, 30_000);

afterAll(async () => {
  await (await import('../../src/lib/prisma')).default.$disconnect();
  await prisma.$disconnect();
  await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
  await admin.$disconnect(); process.env.DATABASE_URL = originalUrl;
});

describe('INVENTORY-01A conteos físicos', () => {
  it('devuelve todos los productos activos sin filtrarlos por balance de la bodega', async () => {
    expect((await request(app).get('/inventory-counts/references?warehouseId=1')).status).toBe(401);
    const response = await request(app).get('/inventory-counts/references?warehouseId=1').set('Authorization', readToken);
    expect(response.status).toBe(200);
    expect(response.body.products.map((product: { internalCode: string }) => product.internalCode).sort()).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(response.body.products.find((product: { internalCode: string }) => product.internalCode === 'P2').systemQuantity).toBe(-0.12);
    expect(response.body.products.find((product: { internalCode: string }) => product.internalCode === 'P4').systemQuantity).toBe(0);

    const searched = await request(app).get('/inventory-counts/references?warehouseId=1&search=p4').set('Authorization', readToken);
    expect(searched.status).toBe(200);
    expect(searched.body.products).toHaveLength(1);
    expect(searched.body.products[0]).toMatchObject({ internalCode: 'P4', name: 'Producto nuevo', systemQuantity: 0 });
  });

  it('protege lectura/escritura, valida bodega, cantidades y productos únicos', async () => {
    expect((await request(app).get('/inventory-counts')).status).toBe(401);
    expect((await request(app).get('/inventory-counts').set('Authorization', writeToken)).status).toBe(200);
    expect((await request(app).post('/inventory-counts').set('Authorization', readToken).send({ warehouseId: 1 })).status).toBe(403);
    expect((await request(app).post('/inventory-counts').set('Authorization', writeToken).send({ warehouseId: 2 })).status).toBe(409);
    expect((await request(app).post('/inventory-movements').set('Authorization', writeToken).send({ type: 'ADJUSTMENT', productId: 1, quantity: 2, destinationWarehouseId: 1 })).status).toBe(400);
    expect((await createCount([{ productId: 1, countedQuantity: -1 }])).status).toBe(400);
    const duplicate = await createCount([{ productId: 1, countedQuantity: 1 }, { productId: 1, countedQuantity: 2 }]);
    expect(duplicate.status).toBe(400); expect(duplicate.body.code).toBe('INVENTORY_PHYSICAL_COUNT_DUPLICATE_PRODUCT');
  });

  it('publica atómicamente faltantes, sobrantes, cero y balance inexistente, con snapshots e idempotencia', async () => {
    const draft = await createCount([
      { productId: 1, countedQuantity: 8 }, { productId: 2, countedQuantity: 0.3 },
      { productId: 3, countedQuantity: 5 }, { productId: 4, countedQuantity: 5 },
    ]);
    expect(draft.status).toBe(201);
    expect(draft.body.items.map((item: { systemQuantitySnapshot: number }) => item.systemQuantitySnapshot)).toEqual([10, -0.12, 5, 0]);
    const posted = await request(app).post(`/inventory-counts/${draft.body.id}/post`).set('Authorization', writeToken).send({});
    expect(posted.status).toBe(200); expect(posted.body.status).toBe('POSTED');
    expect(posted.body.postedBy).toMatchObject({ id: 1, fullName: 'Responsable Inventario' });
    const byProduct = new Map(posted.body.items.map((item: { productId: number }) => [item.productId, item]));
    expect(byProduct.get(1)).toMatchObject({ varianceQuantity: -2, unit: 'g' });
    expect(byProduct.get(1).unitCostSnapshot).toBe('18');
    expect(byProduct.get(1).estimatedValueVariance).toBe('-36');
    expect(byProduct.get(2).varianceQuantity).toBeCloseTo(0.42);
    expect(byProduct.get(3)).toMatchObject({ varianceQuantity: 0, inventoryMovementId: null });
    expect(byProduct.get(4)).toMatchObject({ systemQuantitySnapshot: 0, varianceQuantity: 5 });
    const inventories = await prisma.inventory.findMany({ where: { warehouseId: 1 }, orderBy: { productId: 'asc' }, select: { productId: true, quantity: true } });
    expect(inventories).toEqual([{ productId: 1, quantity: 8 }, { productId: 2, quantity: 0.3 }, { productId: 3, quantity: 5 }, { productId: 4, quantity: 5 }]);
    const movements = await prisma.inventoryMovement.findMany({ where: { type: 'ADJUSTMENT' }, orderBy: { productId: 'asc' }, select: { productId: true, quantity: true, sourceWarehouseId: true, destinationWarehouseId: true } });
    expect(movements).toEqual([
      { productId: 1, quantity: -2, sourceWarehouseId: 1, destinationWarehouseId: null },
      { productId: 2, quantity: 0.42, sourceWarehouseId: null, destinationWarehouseId: 1 },
      { productId: 4, quantity: 5, sourceWarehouseId: null, destinationWarehouseId: 1 },
    ]);
    const listedAdjustments = await request(app)
      .get('/inventory-movements?type=ADJUSTMENT')
      .set('Authorization', readToken);
    expect(listedAdjustments.status).toBe(200);
    expect(listedAdjustments.body.items).toHaveLength(3);
    expect(listedAdjustments.body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ productId: 1, type: 'ADJUSTMENT', sourceWarehouseId: 1, destinationWarehouseId: null }),
      expect.objectContaining({ productId: 4, type: 'ADJUSTMENT', sourceWarehouseId: null, destinationWarehouseId: 1 }),
    ]));
    const retry = await request(app).post(`/inventory-counts/${draft.body.id}/post`).set('Authorization', writeToken).send({});
    expect(retry.status).toBe(200); expect(await prisma.inventoryMovement.count({ where: { type: 'ADJUSTMENT' } })).toBe(3);
    expect((await request(app).post(`/inventory-counts/${draft.body.id}/cancel`).set('Authorization', writeToken).send({})).status).toBe(409);
  });

  it('rechaza el snapshot obsoleto y no publica ni ajusta parcialmente', async () => {
    const draft = await createCount([{ productId: 1, countedQuantity: 7 }, { productId: 3, countedQuantity: 4 }]);
    await prisma.inventory.update({ where: { productId_warehouseId: { productId: 1, warehouseId: 1 } }, data: { quantity: 7.5 } });
    const edited = await request(app).put(`/inventory-counts/${draft.body.id}`).set('Authorization', writeToken).send({ items: [{ productId: 1, countedQuantity: 7 }, { productId: 3, countedQuantity: 4 }] });
    expect(edited.status).toBe(200);
    expect(edited.body.items.find((item: { productId: number }) => item.productId === 1).systemQuantitySnapshot).toBe(8);
    const beforeSecond = await prisma.inventory.findUniqueOrThrow({ where: { productId_warehouseId: { productId: 3, warehouseId: 1 } } });
    const response = await request(app).post(`/inventory-counts/${draft.body.id}/post`).set('Authorization', writeToken).send({});
    expect(response.status).toBe(409); expect(response.body.code).toBe('INVENTORY_PHYSICAL_COUNT_STALE');
    expect(response.body.details.products).toEqual([{ productId: 1, expected: 8, current: 7.5 }]);
    expect((await prisma.inventoryPhysicalCount.findUniqueOrThrow({ where: { id: draft.body.id } })).status).toBe('DRAFT');
    expect((await prisma.inventory.findUniqueOrThrow({ where: { productId_warehouseId: { productId: 3, warehouseId: 1 } } })).quantity).toBe(beforeSecond.quantity);
    expect(await prisma.inventoryMovement.count({ where: { notes: { contains: `#${draft.body.id}` } } })).toBe(0);
    const refreshed = await request(app).post(`/inventory-counts/${draft.body.id}/refresh`).set('Authorization', writeToken).send({});
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.items.find((item: { productId: number }) => item.productId === 1).systemQuantitySnapshot).toBe(7.5);
    expect(refreshed.body.items.every((item: { countedQuantity: number | null }) => item.countedQuantity === null)).toBe(true);
  });

  it('cancela un borrador sin tocar inventario ni movimientos', async () => {
    const draft = await createCount([{ productId: 3, countedQuantity: 2 }]);
    const cancelled = await request(app).post(`/inventory-counts/${draft.body.id}/cancel`).set('Authorization', writeToken).send({});
    expect(cancelled.status).toBe(200); expect(cancelled.body.status).toBe('CANCELLED');
    expect(cancelled.body.cancelledBy.id).toBe(1);
    expect((await prisma.inventory.findUniqueOrThrow({ where: { productId_warehouseId: { productId: 3, warehouseId: 1 } } })).quantity).toBe(5);
    expect(await prisma.inventoryMovement.count({ where: { notes: { contains: `#${draft.body.id}` } } })).toBe(0);
  });
});
