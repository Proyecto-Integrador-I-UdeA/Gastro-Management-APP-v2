import type { Express } from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createIntegrationToken } from './authToken';

const SCHEMA = 'warehouse_operational_uses_test';
const writeToken = `Bearer ${createIntegrationToken(['warehouses.read', 'warehouses.create', 'warehouses.update'], 1)}`;
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
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "warehouses" (
      "id" SERIAL PRIMARY KEY,
      "name" TEXT NOT NULL UNIQUE,
      "description" TEXT,
      "isMain" BOOLEAN NOT NULL DEFAULT false,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRaw`INSERT INTO "warehouses" ("name", "isMain", "active") VALUES ('Bodega Principal', true, true)`;
  const migration = readFileSync(resolve(
    process.cwd(),
    'prisma/migrations/20260915170000_operational_warehouse_routing/migration.sql',
  ), 'utf8');
  for (const statement of migration.split(';').map(part => part.trim()).filter(Boolean)) {
    await prisma.$executeRawUnsafe(statement);
  }
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

describe('usos operativos de bodegas', () => {
  it('migra la única principal activa solo como recepción de compras', async () => {
    const warehouse = await prisma.warehouse.findUniqueOrThrow({ where: { name: 'Bodega Principal' } });
    expect(warehouse).toMatchObject({
      isMain: true,
      purchaseReceiving: true,
      kitchenConsumption: false,
      barConsumption: false,
    });
  });

  it('crea una bodega con múltiples usos operativos simultáneos', async () => {
    const response = await request(app)
      .post('/warehouses')
      .set('Authorization', writeToken)
      .send({
        name: 'Bodega Cocina y Bar',
        active: true,
        kitchenConsumption: true,
        barConsumption: true,
      });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      kitchenConsumption: true,
      barConsumption: true,
      purchaseReceiving: false,
    });
  });

  it('rechaza una segunda bodega activa para el mismo uso', async () => {
    const response = await request(app)
      .post('/warehouses')
      .set('Authorization', writeToken)
      .send({ name: 'Segunda Cocina', active: true, kitchenConsumption: true });
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'WAREHOUSE_OPERATIONAL_USE_CONFLICT',
      operationalUse: 'kitchenConsumption',
    });
    expect(response.body.error).toContain('Bodega Cocina y Bar');
  });

  it('permite configurar el uso en una bodega inactiva, pero impide activarla si produciría conflicto', async () => {
    const created = await request(app)
      .post('/warehouses')
      .set('Authorization', writeToken)
      .send({ name: 'Cocina de respaldo', active: false, kitchenConsumption: true });
    expect(created.status).toBe(201);
    const activated = await request(app)
      .put(`/warehouses/${created.body.id}`)
      .set('Authorization', writeToken)
      .send({ active: true });
    expect(activated.status).toBe(409);
    expect(activated.body.code).toBe('WAREHOUSE_OPERATIONAL_USE_CONFLICT');
    expect((await prisma.warehouse.findUniqueOrThrow({ where: { id: created.body.id } })).active).toBe(false);
  });
});
