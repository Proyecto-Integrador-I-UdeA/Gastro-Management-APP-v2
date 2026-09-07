import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260907120000_menu_sales_01b_media_assets/migration.sql',
  ),
  'utf8',
);

afterAll(async () => {
  await prisma.menuItem.deleteMany({
    where: { name: { startsWith: '__menu_sales_01b_migration__' } },
  });
  await prisma.$disconnect();
});

describe('migración MENU-SALES-01B', () => {
  it('es aditiva y deja imageAssetId nullable para MenuItems existentes', async () => {
    expect(migrationSql).not.toMatch(/^\s*UPDATE\s+/im);
    expect(migrationSql).not.toMatch(/^\s*DELETE\s+FROM\s+/im);

    const columns = await prisma.$queryRaw<Array<{ nullable: string }>>`
      SELECT "is_nullable" AS "nullable"
      FROM "information_schema"."columns"
      WHERE "table_schema" = 'public'
        AND "table_name" = 'MenuItem'
        AND "column_name" = 'imageAssetId'
    `;
    expect(columns).toEqual([{ nullable: 'YES' }]);

    const legacy = await prisma.menuItem.create({
      data: { name: '__menu_sales_01b_migration__ legacy' },
      select: { imageAssetId: true },
    });
    expect(legacy).toEqual({ imageAssetId: null });
  });

  it('aplica FK SET NULL, unicidad 1:1 y constraints defensivas de metadatos', async () => {
    const foreignKey = await prisma.$queryRaw<Array<{
      deleteAction: string;
      updateAction: string;
    }>>`
      SELECT
        "confdeltype"::text AS "deleteAction",
        "confupdtype"::text AS "updateAction"
      FROM "pg_constraint"
      WHERE "conname" = 'MenuItem_imageAssetId_fkey'
    `;
    expect(foreignKey).toEqual([{ deleteAction: 'n', updateAction: 'c' }]);

    const indexes = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT "indexname" AS "name"
      FROM "pg_indexes"
      WHERE "schemaname" = 'public'
        AND "indexname" IN (
          'MenuItem_imageAssetId_key',
          'media_assets_storageKey_key',
          'media_assets_status_createdAt_idx'
        )
      ORDER BY "indexname"
    `;
    expect(indexes.map(index => index.name)).toEqual([
      'MenuItem_imageAssetId_key',
      'media_assets_status_createdAt_idx',
      'media_assets_storageKey_key',
    ]);

    const checks = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT "conname" AS "name"
      FROM "pg_constraint"
      WHERE "conrelid" = 'media_assets'::regclass AND "contype" = 'c'
      ORDER BY "conname"
    `;
    expect(checks.map(check => check.name)).toEqual([
      'media_assets_byteSize_check',
      'media_assets_checksumSha256_check',
      'media_assets_cleanupAttempts_check',
      'media_assets_dimensions_check',
      'media_assets_mimeType_check',
      'media_assets_pixelCount_check',
    ]);
  });
});
