import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260904160000_grant_admin_business_permissions/migration.sql',
  ),
  'utf8',
);

const historicalAdminPermissionNames = [
  'users.read',
  'users.create',
  'users.update',
  'users.delete',
  'products.read',
  'products.create',
  'products.update',
  'products.delete',
  'suppliers.read',
  'suppliers.create',
  'suppliers.update',
  'suppliers.delete',
  'recipes.read',
  'recipes.create',
  'recipes.update',
  'costs.read',
  'costs.update',
  'accounting.read',
  'accounting.update',
  'sales.read',
  'reports.read',
  'inventory.read',
  'inventory.create',
  'transfers.read',
  'transfers.create',
  'transfers.update',
  'transfers.delete',
  'warehouses.read',
  'warehouses.create',
  'warehouses.update',
  'profile.update',
] as const;

const laterPermissionNames = [
  'menu.read',
  'menu.manage',
  'costs.prices.read',
  'platform.tenants.manage',
] as const;

afterAll(async () => {
  await prisma.$disconnect();
});

describe('migración de permisos de negocio para admin', () => {
  it('es aditiva, idempotente y no modifica otros roles', async () => {
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
          "name" TEXT NOT NULL UNIQUE
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
        INSERT INTO "roles" ("name") VALUES ('admin'), ('chef')
      `;

      for (const permissionName of [
        ...historicalAdminPermissionNames,
        ...laterPermissionNames,
      ]) {
        await transaction.$executeRaw`
          INSERT INTO "permissions" ("name") VALUES (${permissionName})
        `;
      }

      await transaction.$executeRaw`
        INSERT INTO "role_permissions" ("roleId", "permissionId")
        SELECT r."id", p."id"
        FROM "roles" AS r
        CROSS JOIN "permissions" AS p
        WHERE r."name" = 'admin' AND p."name" = 'users.read'
      `;
      await transaction.$executeRaw`
        INSERT INTO "role_permissions" ("roleId", "permissionId")
        SELECT r."id", p."id"
        FROM "roles" AS r
        CROSS JOIN "permissions" AS p
        WHERE r."name" = 'chef' AND p."name" = 'recipes.read'
      `;

      await transaction.$executeRawUnsafe(migrationSql);
      await transaction.$executeRawUnsafe(migrationSql);

      const adminPermissions = await transaction.$queryRaw<Array<{ name: string }>>`
        SELECT p."name"
        FROM "role_permissions" AS rp
        JOIN "roles" AS r ON r."id" = rp."roleId"
        JOIN "permissions" AS p ON p."id" = rp."permissionId"
        WHERE r."name" = 'admin'
        ORDER BY p."name"
      `;
      const chefPermissions = await transaction.$queryRaw<Array<{ name: string }>>`
        SELECT p."name"
        FROM "role_permissions" AS rp
        JOIN "roles" AS r ON r."id" = rp."roleId"
        JOIN "permissions" AS p ON p."id" = rp."permissionId"
        WHERE r."name" = 'chef'
        ORDER BY p."name"
      `;
      const duplicates = await transaction.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS "count"
        FROM "role_permissions"
        GROUP BY "roleId", "permissionId"
        HAVING COUNT(*) > 1
      `;
      const persistedAdminPermissionNames = adminPermissions.map(
        permission => permission.name,
      );

      expect(persistedAdminPermissionNames).toEqual(
        [...historicalAdminPermissionNames].sort(),
      );
      for (const laterPermissionName of laterPermissionNames) {
        expect(persistedAdminPermissionNames).not.toContain(laterPermissionName);
      }
      expect(chefPermissions.map(permission => permission.name)).toEqual(['recipes.read']);
      expect(duplicates).toEqual([]);
    });
  });
});
