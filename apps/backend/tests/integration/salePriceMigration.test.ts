import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260905222305_sales_04a2_sale_price_engine/migration.sql',
  ),
  'utf8',
);
const permissionDmlStatements = migrationSql
  .slice(migrationSql.indexOf('-- Reconcile sale-price permissions'))
  .split(/;\s*(?=INSERT INTO)/)
  .map(statement => statement.trim())
  .filter(Boolean);

afterAll(async () => {
  await prisma.menuItem.deleteMany({
    where: { name: { startsWith: '__sales_04a2_migration__' } },
  });
  await prisma.$disconnect();
});

describe('migración SALES-04A2', () => {
  it('crea columnas, FKs, checks e índice único parcial esperados', async () => {
    const columns = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT "column_name" AS "name"
      FROM "information_schema"."columns"
      WHERE "table_schema" = 'public' AND "table_name" = 'menu_item_prices'
    `;
    const columnNames = columns.map(column => column.name);
    expect(columnNames).toEqual(expect.arrayContaining([
      'menuItemId',
      'baseCostSnapshot',
      'indirectCostSnapshot',
      'totalCostSnapshot',
      'marginRate',
      'taxRate',
      'roundingIncrement',
      'amount',
      'createdById',
      'validFrom',
      'validUntil',
    ]));

    const foreignKeys = await prisma.$queryRaw<Array<{
      name: string;
      deleteAction: string;
      updateAction: string;
    }>>`
      SELECT
        "conname" AS "name",
        "confdeltype"::text AS "deleteAction",
        "confupdtype"::text AS "updateAction"
      FROM "pg_constraint"
      WHERE "conname" IN (
        'menu_item_prices_menuItemId_fkey',
        'menu_item_prices_createdById_fkey'
      )
      ORDER BY "conname"
    `;
    expect(foreignKeys).toEqual([
      {
        name: 'menu_item_prices_createdById_fkey',
        deleteAction: 'r',
        updateAction: 'c',
      },
      {
        name: 'menu_item_prices_menuItemId_fkey',
        deleteAction: 'r',
        updateAction: 'c',
      },
    ]);

    const checks = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT "conname" AS "name"
      FROM "pg_constraint"
      WHERE "conrelid" = 'menu_item_prices'::regclass AND "contype" = 'c'
      ORDER BY "conname"
    `;
    expect(checks.map(check => check.name)).toEqual([
      'menu_item_prices_amount_positive_check',
      'menu_item_prices_baseCostSnapshot_nonnegative_check',
      'menu_item_prices_indirectCostSnapshot_nonnegative_check',
      'menu_item_prices_marginRate_range_check',
      'menu_item_prices_roundingIncrement_positive_check',
      'menu_item_prices_taxRate_range_check',
      'menu_item_prices_totalCostSnapshot_nonnegative_check',
      'menu_item_prices_validity_range_check',
    ]);

    const indexes = await prisma.$queryRaw<Array<{ definition: string }>>`
      SELECT "indexdef" AS "definition"
      FROM "pg_indexes"
      WHERE "schemaname" = 'public'
        AND "indexname" = 'menu_item_prices_one_open_per_menu_item_idx'
    `;
    expect(indexes).toHaveLength(1);
    expect(indexes[0].definition).toContain('UNIQUE INDEX');
    expect(indexes[0].definition).toContain('WHERE ("validUntil" IS NULL)');
  });

  it('no crea precios para un MenuItem existente', async () => {
    const menuItem = await prisma.menuItem.create({
      data: { name: '__sales_04a2_migration__ sin backfill' },
    });

    expect(await prisma.menuItem.findUnique({ where: { id: menuItem.id } })).not.toBeNull();
    expect(await prisma.menuItemPrice.count({ where: { menuItemId: menuItem.id } })).toBe(0);
  });

  it('mantiene la DML aditiva, idempotente y limitada por rol', async () => {
    await prisma.$transaction(async transaction => {
      await transaction.$executeRawUnsafe(`
        CREATE TEMP TABLE "roles" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL UNIQUE
        ) ON COMMIT DROP
      `);
      await transaction.$executeRawUnsafe(`
        CREATE TEMP TABLE "permissions" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL UNIQUE,
          "description" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ON COMMIT DROP
      `);
      await transaction.$executeRawUnsafe(`
        CREATE TEMP TABLE "role_permissions" (
          "id" SERIAL PRIMARY KEY,
          "roleId" INTEGER NOT NULL,
          "permissionId" INTEGER NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE ("roleId", "permissionId")
        ) ON COMMIT DROP
      `);
      await transaction.$executeRaw`
        INSERT INTO "roles" ("name")
        VALUES ('super'), ('admin'), ('accounting'), ('chef'), ('purchases')
      `;
      await transaction.$executeRaw`
        INSERT INTO "permissions" ("name") VALUES ('costs.prices.read')
      `;
      await transaction.$executeRaw`
        INSERT INTO "role_permissions" ("roleId", "permissionId")
        SELECT r."id", p."id"
        FROM "roles" AS r
        CROSS JOIN "permissions" AS p
        WHERE r."name" = 'chef' AND p."name" = 'costs.prices.read'
      `;

      for (let execution = 0; execution < 2; execution += 1) {
        for (const statement of permissionDmlStatements) {
          await transaction.$executeRawUnsafe(statement);
        }
      }

      const grants = await transaction.$queryRaw<Array<{
        roleName: string;
        permissionName: string;
      }>>`
        SELECT r."name" AS "roleName", p."name" AS "permissionName"
        FROM "role_permissions" AS rp
        JOIN "roles" AS r ON r."id" = rp."roleId"
        JOIN "permissions" AS p ON p."id" = rp."permissionId"
        ORDER BY r."name", p."name"
      `;
      expect(grants).toEqual([
        { roleName: 'accounting', permissionName: 'costs.prices.read' },
        { roleName: 'admin', permissionName: 'costs.prices.manage' },
        { roleName: 'admin', permissionName: 'costs.prices.read' },
        { roleName: 'chef', permissionName: 'costs.prices.read' },
        { roleName: 'super', permissionName: 'costs.prices.manage' },
        { roleName: 'super', permissionName: 'costs.prices.read' },
      ]);
      expect(grants).not.toContainEqual({
        roleName: 'accounting',
        permissionName: 'costs.prices.manage',
      });
      expect(grants).not.toContainEqual({
        roleName: 'purchases',
        permissionName: 'costs.prices.manage',
      });
    });
  });
});
