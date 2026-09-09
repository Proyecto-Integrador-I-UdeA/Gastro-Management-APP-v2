import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';

const TEST_SCHEMA = 'kitchen_01a_migration_test';
const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260909120000_kitchen_01a_dispatch_foundation/migration.sql',
  ),
  'utf8',
);
const migrationStatements = migrationSql
  .split(';')
  .map(statement => statement.trim())
  .filter(Boolean);

async function withMigratedKitchen(
  assertions: (transaction: Prisma.TransactionClient) => Promise<void>,
) {
  await prisma.$transaction(async transaction => {
    await transaction.$executeRawUnsafe(`CREATE SCHEMA "${TEST_SCHEMA}"`);
    try {
      await transaction.$executeRawUnsafe(`SET LOCAL search_path TO "${TEST_SCHEMA}"`);
      await transaction.$executeRawUnsafe(`CREATE TABLE "users" ("id" INTEGER PRIMARY KEY)`);
      await transaction.$executeRawUnsafe(`CREATE TABLE "sales_orders" ("id" INTEGER PRIMARY KEY)`);
      await transaction.$executeRawUnsafe(`CREATE TABLE "sales_order_items" ("id" INTEGER PRIMARY KEY)`);
      await transaction.$executeRawUnsafe(`
        CREATE TABLE "roles" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL UNIQUE
        )
      `);
      await transaction.$executeRawUnsafe(`
        CREATE TABLE "permissions" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL UNIQUE,
          "description" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await transaction.$executeRawUnsafe(`
        CREATE TABLE "role_permissions" (
          "id" SERIAL PRIMARY KEY,
          "roleId" INTEGER NOT NULL,
          "permissionId" INTEGER NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE ("roleId", "permissionId")
        )
      `);
      await transaction.$executeRaw`
        INSERT INTO "roles" ("name")
        VALUES ('super'), ('admin'), ('chef'), ('accounting'), ('purchases')
      `;

      for (const statement of migrationStatements) {
        await transaction.$executeRawUnsafe(statement);
      }
      await assertions(transaction);
    } finally {
      await transaction.$executeRawUnsafe(`DROP SCHEMA "${TEST_SCHEMA}" CASCADE`);
    }
  });
}

async function expectConstraintViolation(
  transaction: Prisma.TransactionClient,
  savepoint: string,
  sql: string,
  expectedSqlState: '23503' | '23505' | '23514',
) {
  await transaction.$executeRawUnsafe(`SAVEPOINT "${savepoint}"`);
  let caughtError: unknown;
  try {
    await transaction.$executeRawUnsafe(sql);
  } catch (error) {
    caughtError = error;
  }
  await transaction.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT "${savepoint}"`);
  await transaction.$executeRawUnsafe(`RELEASE SAVEPOINT "${savepoint}"`);

  expect(caughtError).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  const prismaError = caughtError as Prisma.PrismaClientKnownRequestError;
  expect(prismaError.code).toBe('P2010');
  expect(prismaError.meta?.code).toBe(expectedSqlState);
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('migración KITCHEN-01A', () => {
  it('es forward-only y no añade estado de cocina a SalesOrder', () => {
    expect(migrationSql).not.toMatch(/^\s*(?:DROP|DELETE|UPDATE)\s/im);
    expect(migrationSql).toContain("AS ENUM ('NEXT', 'PREPARING', 'READY')");
    expect(migrationSql).toContain('CREATE TABLE "kitchen_dispatches"');
    expect(migrationSql).toContain('CREATE TABLE "kitchen_dispatch_items"');
    expect(migrationSql).not.toMatch(/ALTER TABLE "sales_orders" ADD COLUMN/i);
    expect(migrationSql).not.toMatch(/kitchenStatus|sentToKitchen|sentAt/i);
  });

  it('registra permisos idempotentes solo para super, admin y chef', async () => {
    await withMigratedKitchen(async transaction => {
      const dataStatements = migrationStatements.filter(statement => (
        statement.includes('INSERT INTO "permissions"')
        || statement.includes('INSERT INTO "role_permissions"')
      ));
      for (const statement of dataStatements) {
        await transaction.$executeRawUnsafe(statement);
      }

      const permissions = await transaction.$queryRaw<Array<{ name: string }>>`
        SELECT "name"
        FROM "permissions"
        WHERE "name" LIKE 'kitchen.%'
        ORDER BY "name"
      `;
      const grants = await transaction.$queryRaw<Array<{
        roleName: string;
        permissionName: string;
      }>>`
        SELECT r."name" AS "roleName", p."name" AS "permissionName"
        FROM "role_permissions" AS rp
        JOIN "roles" AS r ON r."id" = rp."roleId"
        JOIN "permissions" AS p ON p."id" = rp."permissionId"
        WHERE p."name" LIKE 'kitchen.%'
        ORDER BY r."name", p."name"
      `;

      expect(permissions).toEqual([
        { name: 'kitchen.manage' },
        { name: 'kitchen.read' },
      ]);
      expect(grants).toEqual([
        { roleName: 'admin', permissionName: 'kitchen.manage' },
        { roleName: 'admin', permissionName: 'kitchen.read' },
        { roleName: 'chef', permissionName: 'kitchen.manage' },
        { roleName: 'chef', permissionName: 'kitchen.read' },
        { roleName: 'super', permissionName: 'kitchen.manage' },
        { roleName: 'super', permissionName: 'kitchen.read' },
      ]);
    });
  });

  it('aplica defaults y evita reenviar una línea o autorreferenciar el padre', async () => {
    await withMigratedKitchen(async transaction => {
      await transaction.$executeRaw`INSERT INTO "users" ("id") VALUES (1)`;
      await transaction.$executeRaw`INSERT INTO "sales_orders" ("id") VALUES (10)`;
      await transaction.$executeRaw`INSERT INTO "sales_order_items" ("id") VALUES (20), (21)`;
      const [dispatch] = await transaction.$queryRaw<Array<{
        id: number;
        status: string;
        prepTimeMinutesSnapshot: number;
      }>>`
        INSERT INTO "kitchen_dispatches" (
          "salesOrderId", "dispatchedById", "targetReadyAt"
        )
        VALUES (10, 1, CURRENT_TIMESTAMP + INTERVAL '15 minutes')
        RETURNING "id", "status", "prepTimeMinutesSnapshot"
      `;
      const [item] = await transaction.$queryRaw<Array<{ id: number }>>`
        INSERT INTO "kitchen_dispatch_items" (
          "kitchenDispatchId", "salesOrderItemId", "itemNameSnapshot", "quantitySnapshot"
        )
        VALUES (${dispatch.id}, 20, 'Plato', 1)
        RETURNING "id"
      `;

      expect(dispatch).toMatchObject({ status: 'NEXT', prepTimeMinutesSnapshot: 15 });
      await expectConstraintViolation(
        transaction,
        'same_order_item_twice',
        `INSERT INTO "kitchen_dispatch_items" ("kitchenDispatchId", "salesOrderItemId", "itemNameSnapshot", "quantitySnapshot") VALUES (${dispatch.id}, 20, 'Duplicado', 1)`,
        '23505',
      );
      await expectConstraintViolation(
        transaction,
        'parent_self',
        `INSERT INTO "kitchen_dispatch_items" ("id", "kitchenDispatchId", "salesOrderItemId", "parentDispatchItemId", "itemNameSnapshot", "quantitySnapshot") VALUES (${item.id + 1000}, ${dispatch.id}, 21, ${item.id + 1000}, 'Autorreferencia', 1)`,
        '23514',
      );

      const [otherDispatch] = await transaction.$queryRaw<Array<{ id: number }>>`
        INSERT INTO "kitchen_dispatches" (
          "salesOrderId", "dispatchedById", "targetReadyAt"
        )
        VALUES (10, 1, CURRENT_TIMESTAMP + INTERVAL '15 minutes')
        RETURNING "id"
      `;
      await expectConstraintViolation(
        transaction,
        'cross_dispatch_parent',
        `INSERT INTO "kitchen_dispatch_items" ("kitchenDispatchId", "salesOrderItemId", "parentDispatchItemId", "itemNameSnapshot", "quantitySnapshot") VALUES (${otherDispatch.id}, 21, ${item.id}, 'Otra adición', 1)`,
        '23503',
      );
    });
  });
});
