import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260905212034_sales_04a1_menu_categories/migration.sql',
  ),
  'utf8',
);
const permissionDml = migrationSql.slice(
  migrationSql.indexOf('-- Reconcile menu permissions'),
);
const permissionDmlStatements = permissionDml
  .split(/;\s*(?=INSERT INTO)/)
  .map(statement => statement.trim())
  .filter(Boolean);

afterAll(async () => {
  await prisma.menuItem.deleteMany({
    where: { name: { startsWith: '__sales_04a1_migration__' } },
  });
  await prisma.menuCategory.deleteMany({
    where: { name: { startsWith: '__sales_04a1_migration__' } },
  });
  await prisma.$disconnect();
});

describe('migración SALES-04A1', () => {
  it('define categoryId nullable, FK SET NULL/CASCADE y CHECK de displayOrder', async () => {
    const columns = await prisma.$queryRaw<Array<{ isNullable: string }>>`
      SELECT "is_nullable" AS "isNullable"
      FROM "information_schema"."columns"
      WHERE "table_schema" = 'public'
        AND "table_name" = 'MenuItem'
        AND "column_name" = 'categoryId'
    `;
    const foreignKeys = await prisma.$queryRaw<Array<{
      deleteAction: string;
      updateAction: string;
    }>>`
      SELECT
        "confdeltype"::text AS "deleteAction",
        "confupdtype"::text AS "updateAction"
      FROM "pg_constraint"
      WHERE "conname" = 'MenuItem_categoryId_fkey'
    `;
    const checks = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT "conname" AS "name"
      FROM "pg_constraint"
      WHERE "conname" = 'menu_categories_displayOrder_nonnegative_check'
    `;

    expect(columns).toEqual([{ isNullable: 'YES' }]);
    expect(foreignKeys).toEqual([{ deleteAction: 'n', updateAction: 'c' }]);
    expect(checks).toEqual([
      { name: 'menu_categories_displayOrder_nonnegative_check' },
    ]);

    await expect(prisma.menuCategory.create({
      data: {
        name: '__sales_04a1_migration__ negativa',
        normalizedName: '__sales_04a1_migration__ negativa',
        displayOrder: -1,
      },
    })).rejects.toThrow();
    expect(await prisma.menuCategory.count({
      where: { normalizedName: '__sales_04a1_migration__ negativa' },
    })).toBe(0);
  });

  it('aplica ON DELETE SET NULL sin eliminar el MenuItem asociado', async () => {
    const category = await prisma.menuCategory.create({
      data: {
        name: '__sales_04a1_migration__ set null',
        normalizedName: '__sales_04a1_migration__ set null',
      },
    });
    const menuItem = await prisma.menuItem.create({
      data: {
        name: '__sales_04a1_migration__ plato',
        categoryId: category.id,
      },
    });

    await prisma.menuCategory.delete({ where: { id: category.id } });

    expect(await prisma.menuItem.findUnique({ where: { id: menuItem.id } }))
      .toMatchObject({ categoryId: null });
  });

  it('mantiene la DML de permisos aditiva, idempotente y limitada a roles objetivo', async () => {
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
        VALUES ('super'), ('admin'), ('chef'), ('purchases')
      `;
      await transaction.$executeRaw`
        INSERT INTO "permissions" ("name") VALUES ('menu.read')
      `;
      await transaction.$executeRaw`
        INSERT INTO "role_permissions" ("roleId", "permissionId")
        SELECT r."id", p."id"
        FROM "roles" AS r
        CROSS JOIN "permissions" AS p
        WHERE r."name" = 'purchases' AND p."name" = 'menu.read'
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
      const duplicates = await transaction.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS "count"
        FROM "role_permissions"
        GROUP BY "roleId", "permissionId"
        HAVING COUNT(*) > 1
      `;

      expect(grants).toEqual([
        { roleName: 'admin', permissionName: 'menu.manage' },
        { roleName: 'admin', permissionName: 'menu.read' },
        { roleName: 'chef', permissionName: 'menu.manage' },
        { roleName: 'chef', permissionName: 'menu.read' },
        { roleName: 'purchases', permissionName: 'menu.read' },
        { roleName: 'super', permissionName: 'menu.manage' },
        { roleName: 'super', permissionName: 'menu.read' },
      ]);
      expect(duplicates).toEqual([]);
    });
  });
});
