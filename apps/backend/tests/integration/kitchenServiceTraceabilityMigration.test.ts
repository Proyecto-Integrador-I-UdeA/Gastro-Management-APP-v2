import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';

const TEST_SCHEMA = 'kitchen_01c_migration_test';
const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260909180000_kitchen_01c_service_traceability/migration.sql',
  ),
  'utf8',
);
const migrationStatements = migrationSql
  .split(';')
  .map(statement => statement.trim())
  .filter(Boolean);

async function withMigration(
  assertions: (transaction: Prisma.TransactionClient) => Promise<void>,
) {
  await prisma.$transaction(async transaction => {
    await transaction.$executeRawUnsafe(`CREATE SCHEMA "${TEST_SCHEMA}"`);
    try {
      await transaction.$executeRawUnsafe(`SET LOCAL search_path TO "${TEST_SCHEMA}"`);
      await transaction.$executeRawUnsafe(
        `CREATE TYPE "SalesOrderStatus" AS ENUM ('OPEN', 'SETTLED', 'VOIDED')`,
      );
      await transaction.$executeRawUnsafe(
        `CREATE TYPE "KitchenDispatchStatus" AS ENUM ('NEXT', 'PREPARING', 'READY')`,
      );
      await transaction.$executeRawUnsafe(`CREATE TABLE "users" ("id" INTEGER PRIMARY KEY)`);
      await transaction.$executeRawUnsafe(`
        CREATE TABLE "sales_orders" (
          "id" INTEGER PRIMARY KEY,
          "status" "SalesOrderStatus" NOT NULL DEFAULT 'OPEN',
          "openedById" INTEGER NOT NULL,
          "voidedAt" TIMESTAMP(3)
        )
      `);
      await transaction.$executeRawUnsafe(`
        CREATE TABLE "kitchen_dispatches" (
          "id" INTEGER PRIMARY KEY,
          "salesOrderId" INTEGER NOT NULL,
          "status" "KitchenDispatchStatus" NOT NULL DEFAULT 'NEXT',
          "dispatchedById" INTEGER NOT NULL,
          "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "startedAt" TIMESTAMP(3),
          "readyAt" TIMESTAMP(3)
        )
      `);
      await transaction.$executeRawUnsafe(`INSERT INTO "users" ("id") VALUES (90)`);
      await transaction.$executeRawUnsafe(`
        INSERT INTO "sales_orders" (
          "id", "status", "openedById", "voidedAt"
        ) VALUES
          (90, 'OPEN', 90, NULL),
          (91, 'VOIDED', 90, CURRENT_TIMESTAMP)
      `);
      await transaction.$executeRawUnsafe(`
        INSERT INTO "kitchen_dispatches" (
          "id", "salesOrderId", "status", "dispatchedById",
          "dispatchedAt", "startedAt", "readyAt"
        ) VALUES
          (90, 90, 'PREPARING', 90, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL),
          (91, 91, 'READY', 90, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      for (const statement of migrationStatements) {
        await transaction.$executeRawUnsafe(statement);
      }
      await assertions(transaction);
    } finally {
      await transaction.$executeRawUnsafe(`DROP SCHEMA "${TEST_SCHEMA}" CASCADE`);
    }
  });
}

async function expectCheckViolation(
  transaction: Prisma.TransactionClient,
  savepoint: string,
  sql: string,
) {
  await transaction.$executeRawUnsafe(`SAVEPOINT "${savepoint}"`);
  let caught: unknown;
  try {
    await transaction.$executeRawUnsafe(sql);
  } catch (error) {
    caught = error;
  }
  await transaction.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT "${savepoint}"`);
  await transaction.$executeRawUnsafe(`RELEASE SAVEPOINT "${savepoint}"`);
  expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  expect((caught as Prisma.PrismaClientKnownRequestError).meta?.code).toBe('23514');
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('migración KITCHEN-01C', () => {
  it('es aditiva y conserva NEXT/PREPARING/READY como únicos estados de preparación', () => {
    expect(migrationSql).not.toMatch(/^\s*(?:DROP|DELETE|UPDATE)\s/im);
    expect(migrationSql).not.toMatch(/ALTER TYPE|DELIVERED/);
    expect(migrationSql).toContain('ADD COLUMN "deliveredAt" TIMESTAMP(3)');
    expect(migrationSql).toContain('ADD COLUMN "cancellationReason" VARCHAR(500)');
  });

  it('acepta y preserva filas pre-01C con timestamps históricos sin actor', async () => {
    await withMigration(async transaction => {
      const dispatches = await transaction.$queryRaw<Array<{
        id: number;
        status: string;
        startedAt: Date | null;
        startedById: number | null;
        readyAt: Date | null;
        readyById: number | null;
      }>>`
        SELECT
          "id", "status", "startedAt", "startedById", "readyAt", "readyById"
        FROM "kitchen_dispatches"
        WHERE "id" IN (90, 91)
        ORDER BY "id"
      `;

      expect(dispatches).toEqual([
        expect.objectContaining({
          id: 90,
          status: 'PREPARING',
          startedAt: expect.any(Date),
          startedById: null,
          readyAt: null,
          readyById: null,
        }),
        expect.objectContaining({
          id: 91,
          status: 'READY',
          startedAt: expect.any(Date),
          startedById: null,
          readyAt: expect.any(Date),
          readyById: null,
        }),
      ]);

      const legacyVoided = await transaction.$queryRaw<Array<{
        id: number;
        cancelledById: number | null;
        cancellationReason: string | null;
      }>>`
        SELECT "id", "cancelledById", "cancellationReason"
        FROM "sales_orders"
        WHERE "id" = 91
      `;
      expect(legacyVoided).toEqual([{
        id: 91,
        cancelledById: null,
        cancellationReason: null,
      }]);

      await transaction.$executeRawUnsafe(`
        UPDATE "kitchen_dispatches"
        SET "deliveredAt" = CURRENT_TIMESTAMP, "deliveredById" = 90
        WHERE "id" = 91
      `);
      await transaction.$executeRawUnsafe(`
        UPDATE "sales_orders"
        SET "voidedAt" = "voidedAt"
        WHERE "id" = 91
      `);

      const updatedLegacyDispatch = await transaction.$queryRaw<Array<{
        deliveredAt: Date | null;
        deliveredById: number | null;
      }>>`
        SELECT "deliveredAt", "deliveredById"
        FROM "kitchen_dispatches"
        WHERE "id" = 91
      `;
      expect(updatedLegacyDispatch).toEqual([{
        deliveredAt: expect.any(Date),
        deliveredById: 90,
      }]);
    });
  });

  it('crea campos, FKs, índices y pares atómicos de entrega/acuse', async () => {
    await withMigration(async transaction => {
      await transaction.$executeRaw`INSERT INTO "users" ("id") VALUES (1), (2)`;
      await transaction.$executeRaw`
        INSERT INTO "sales_orders" ("id", "openedById") VALUES (10, 1)
      `;
      await transaction.$executeRaw`
        INSERT INTO "kitchen_dispatches" (
          "id", "salesOrderId", "status", "dispatchedById", "startedAt", "readyAt",
          "startedById", "readyById",
          "deliveredAt", "deliveredById"
        ) VALUES (
          20, 10, 'READY', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
          2, 2, CURRENT_TIMESTAMP, 1
        )
      `;

      const columns = await transaction.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = ${TEST_SCHEMA}
          AND column_name IN (
            'startedById', 'readyById', 'deliveredAt', 'deliveredById',
            'cancelledById', 'cancellationReason',
            'cancellationAcknowledgedAt', 'cancellationAcknowledgedById'
          )
        ORDER BY column_name
      `;
      expect(columns).toHaveLength(8);

      await expectCheckViolation(
        transaction,
        'delivery_pair',
        `UPDATE "kitchen_dispatches" SET "deliveredById" = NULL WHERE "id" = 20`,
      );
      await expectCheckViolation(
        transaction,
        'ack_pair',
        `UPDATE "sales_orders" SET "cancellationAcknowledgedAt" = CURRENT_TIMESTAMP WHERE "id" = 10`,
      );
    });
  });
});
