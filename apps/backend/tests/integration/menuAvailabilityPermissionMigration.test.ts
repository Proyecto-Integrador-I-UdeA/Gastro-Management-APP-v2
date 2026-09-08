import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260908120000_sales_02b1_menu_availability_permission/migration.sql',
  ),
  'utf8',
);
const migrationStatements = migrationSql
  .split(';')
  .map(statement => statement.trim())
  .filter(Boolean);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('migración de permiso operativo de disponibilidad', () => {
  it('es aditiva, idempotente y no concede acceso a accounting ni purchases', async () => {
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
        VALUES ('super'), ('admin'), ('chef'), ('accounting'), ('purchases')
      `;

      for (let execution = 0; execution < 2; execution += 1) {
        for (const statement of migrationStatements) {
          await transaction.$executeRawUnsafe(statement);
        }
      }

      const grants = await transaction.$queryRaw<Array<{ roleName: string }>>`
        SELECT r."name" AS "roleName"
        FROM "role_permissions" AS rp
        JOIN "roles" AS r ON r."id" = rp."roleId"
        JOIN "permissions" AS p ON p."id" = rp."permissionId"
        WHERE p."name" = 'menu.availability.manage'
        ORDER BY r."name"
      `;
      const permissions = await transaction.$queryRaw<Array<{ name: string }>>`
        SELECT "name" FROM "permissions"
        WHERE "name" = 'menu.availability.manage'
      `;

      expect(permissions).toEqual([{ name: 'menu.availability.manage' }]);
      expect(grants).toEqual([
        { roleName: 'admin' },
        { roleName: 'chef' },
        { roleName: 'super' },
      ]);
    });
  });
});
