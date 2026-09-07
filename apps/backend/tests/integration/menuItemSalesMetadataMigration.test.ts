import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';

const PREFIX = '__menu_sales_01c_migration__';
const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260907130000_menu_sales_01c_menu_item_sales_metadata/migration.sql',
  ),
  'utf8',
);

afterAll(async () => {
  await prisma.menuItem.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe('migración MENU-SALES-01C', () => {
  it('es aditiva y define los defaults seguros para registros legacy', async () => {
    expect(migrationSql).not.toMatch(/^\s*UPDATE\s+/im);
    expect(migrationSql).not.toMatch(/^\s*DELETE\s+FROM\s+/im);
    expect(migrationSql).toContain('DEFAULT \'STANDARD\'');
    expect(migrationSql).toContain('DEFAULT true');

    const columns = await prisma.$queryRaw<Array<{
      name: string;
      nullable: string;
      maximumLength: number | null;
    }>>`
      SELECT
        "column_name" AS "name",
        "is_nullable" AS "nullable",
        "character_maximum_length" AS "maximumLength"
      FROM "information_schema"."columns"
      WHERE "table_schema" = 'public'
        AND "table_name" = 'MenuItem'
        AND "column_name" IN ('kind', 'available', 'includedItemsText')
      ORDER BY "column_name"
    `;
    expect(columns).toEqual([
      { name: 'available', nullable: 'NO', maximumLength: null },
      { name: 'includedItemsText', nullable: 'YES', maximumLength: 500 },
      { name: 'kind', nullable: 'NO', maximumLength: null },
    ]);

    const legacy = await prisma.menuItem.create({
      data: { name: `${PREFIX}legacy` },
      select: { kind: true, available: true, includedItemsText: true },
    });
    expect(legacy).toEqual({
      kind: 'STANDARD',
      available: true,
      includedItemsText: null,
    });
  });

  it('crea exclusivamente los valores STANDARD y ADDITION en el enum físico', async () => {
    const enumValues = await prisma.$queryRaw<Array<{ value: string }>>`
      SELECT "enumlabel" AS "value"
      FROM "pg_enum"
      JOIN "pg_type" ON "pg_type"."oid" = "pg_enum"."enumtypid"
      WHERE "pg_type"."typname" = 'MenuItemKind'
      ORDER BY "pg_enum"."enumsortorder"
    `;
    expect(enumValues.map(entry => entry.value)).toEqual(['STANDARD', 'ADDITION']);
  });
});
