import type { Express } from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createIntegrationToken } from './authToken';

const SCHEMA = 'inventory_movement_units_test';
const token = `Bearer ${createIntegrationToken(['inventory.create', 'inventory.read', 'transfers.create', 'transfers.read'], 1)}`;
let app: Express;
let prisma: PrismaClient;
let admin: PrismaClient;
let originalUrl: string;

beforeAll(async () => {
  originalUrl = process.env.DATABASE_URL as string;
  const base = process.env.TEST_DATABASE_URL as string;
  const url = new URL(base);
  url.searchParams.set('schema', SCHEMA);
  admin = new PrismaClient({ datasources: { db: { url: base } } });
  await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${SCHEMA}"`);
  prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  for (const sql of [
    `CREATE TYPE "MovementType" AS ENUM ('PURCHASE','TRANSFER','WASTE','CONSUMPTION','ADJUSTMENT')`,
    `CREATE TYPE "ProductBaseUnit" AS ENUM ('g','ml','und')`,
    `CREATE TABLE "users" ("id" SERIAL PRIMARY KEY,"email" TEXT NOT NULL UNIQUE,"passwordHash" TEXT NOT NULL,"fullName" TEXT,"roleId" INTEGER,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"active" BOOLEAN DEFAULT true)`,
    `CREATE TABLE "suppliers" ("id" SERIAL PRIMARY KEY,"internalCode" TEXT NOT NULL UNIQUE,"name" TEXT NOT NULL,"taxId" TEXT NOT NULL,"phone" TEXT NOT NULL,"address" TEXT NOT NULL,"contactPerson" TEXT NOT NULL,"active" BOOLEAN DEFAULT true,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE "warehouses" ("id" SERIAL PRIMARY KEY,"name" TEXT NOT NULL UNIQUE,"description" TEXT,"isMain" BOOLEAN DEFAULT false,"active" BOOLEAN DEFAULT true,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE "products" ("id" SERIAL PRIMARY KEY,"internalCode" TEXT NOT NULL UNIQUE,"name" TEXT NOT NULL,"category" TEXT DEFAULT '',"isIngredient" BOOLEAN DEFAULT true,"isSupply" BOOLEAN DEFAULT false,"isFinishedProduct" BOOLEAN DEFAULT false,"presentation" TEXT NOT NULL,"inputUnit" TEXT NOT NULL,"inputUnitQuantity" DOUBLE PRECISION NOT NULL,"minStock" DOUBLE PRECISION NOT NULL,"maxStock" DOUBLE PRECISION NOT NULL,"currentStock" DOUBLE PRECISION DEFAULT 0,"unitCost" DOUBLE PRECISION NOT NULL,"active" BOOLEAN DEFAULT true,"supplierId" INTEGER NOT NULL,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"unitOfMeasure" "ProductBaseUnit" NOT NULL,"catalogId" INTEGER,"isSeedProduct" BOOLEAN DEFAULT false)`,
    `CREATE TABLE "inventories" ("id" SERIAL PRIMARY KEY,"quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,"productId" INTEGER NOT NULL,"warehouseId" INTEGER NOT NULL,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,UNIQUE("productId","warehouseId"))`,
    `CREATE TABLE "inventory_movements" ("id" SERIAL PRIMARY KEY,"type" "MovementType" NOT NULL,"quantity" DOUBLE PRECISION NOT NULL,"unitCost" DECIMAL(10,2),"expirationDate" TIMESTAMP(3),"notes" TEXT,"productId" INTEGER NOT NULL,"sourceWarehouseId" INTEGER,"destinationWarehouseId" INTEGER,"userId" INTEGER NOT NULL,"createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)`,
  ]) await prisma.$executeRawUnsafe(sql);
  const migration = readFileSync(resolve(process.cwd(), 'prisma/migrations/20260915170000_operational_warehouse_routing/migration.sql'), 'utf8');
  for (const statement of migration.split(';').map(part => part.trim()).filter(Boolean)) {
    await prisma.$executeRawUnsafe(statement);
  }
  await prisma.$executeRaw`INSERT INTO "users" ("id","email","passwordHash","fullName") VALUES (1,'inventory-units@test.local','x','Responsable')`;
  await prisma.$executeRaw`INSERT INTO "suppliers" ("id","internalCode","name","taxId","phone","address","contactPerson") VALUES (1,'SUP-1','Proveedor','0','0','—','Contacto')`;
  await prisma.$executeRaw`INSERT INTO "warehouses" ("id","name","isMain","active") VALUES (1,'Bodega Principal',true,true),(2,'Bodega Cocina',false,true)`;
  await prisma.$executeRaw`INSERT INTO "products" ("id","internalCode","name","presentation","inputUnit","inputUnitQuantity","minStock","maxStock","unitCost","supplierId","unitOfMeasure") VALUES (1,'P-001','Pechuga de pollo','Saco','kg',1,0,100000,18000,1,'g')`;
  await prisma.$executeRaw`INSERT INTO "inventories" ("productId","warehouseId","quantity") VALUES (1,1,-600),(1,2,0)`;
  process.env.DATABASE_URL = url.toString();
  app = (await import('../../src/app')).default;
}, 30_000);

afterAll(async () => {
  await (await import('../../src/lib/prisma')).default.$disconnect();
  await prisma.$disconnect();
  await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
  await admin.$disconnect();
  process.env.DATABASE_URL = originalUrl;
});

describe('normalización canónica de cantidades de movimientos', () => {
  it('convierte PURCHASE, TRANSFER y WASTE desde kg a gramos base', async () => {
    const purchase = await request(app).post('/inventory-movements').set('Authorization', token).send({
      type: 'PURCHASE', productId: 1, quantity: 10, unitCost: 18000, destinationWarehouseId: 1,
    });
    expect(purchase.status).toBe(201);
    expect(purchase.body.quantity).toBe(10000);
    expect((await prisma.inventory.findUniqueOrThrow({ where: { productId_warehouseId: { productId: 1, warehouseId: 1 } } })).quantity).toBe(9400);

    const transfer = await request(app).post('/inventory-movements').set('Authorization', token).send({
      type: 'TRANSFER', productId: 1, quantity: 2, sourceWarehouseId: 1, destinationWarehouseId: 2,
    });
    expect(transfer.status).toBe(201);
    expect(transfer.body.quantity).toBe(2000);
    expect((await prisma.inventory.findUniqueOrThrow({ where: { productId_warehouseId: { productId: 1, warehouseId: 1 } } })).quantity).toBe(7400);
    expect((await prisma.inventory.findUniqueOrThrow({ where: { productId_warehouseId: { productId: 1, warehouseId: 2 } } })).quantity).toBe(2000);

    const waste = await request(app).post('/inventory-movements').set('Authorization', token).send({
      type: 'WASTE', productId: 1, quantity: 0.25, sourceWarehouseId: 2,
    });
    expect(waste.status).toBe(201);
    expect(waste.body.quantity).toBe(250);
    expect((await prisma.inventory.findUniqueOrThrow({ where: { productId_warehouseId: { productId: 1, warehouseId: 2 } } })).quantity).toBe(1750);
  });

  it('mantiene CONSUMPTION en unidad base, sin volver a convertirla', async () => {
    const consumption = await request(app).post('/inventory-movements').set('Authorization', token).send({
      type: 'CONSUMPTION', productId: 1, quantity: 300, sourceWarehouseId: 2,
    });
    expect(consumption.status).toBe(201);
    expect(consumption.body.quantity).toBe(300);
    expect((await prisma.inventory.findUniqueOrThrow({ where: { productId_warehouseId: { productId: 1, warehouseId: 2 } } })).quantity).toBe(1450);
  });
});
