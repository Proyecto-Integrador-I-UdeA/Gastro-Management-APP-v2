import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import prisma from '../../src/lib/prisma';

const TEST_SCHEMA = 'sales_02c_foundation_test';
const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260908160000_sales_02c_tables_orders_foundation/migration.sql',
  ),
  'utf8',
);
const migrationStatements = migrationSql
  .split(';')
  .map(statement => statement.trim())
  .filter(Boolean);

async function withMigratedFoundation(
  assertions: (transaction: Prisma.TransactionClient) => Promise<void>,
) {
  await prisma.$transaction(async transaction => {
    await transaction.$executeRawUnsafe(`CREATE SCHEMA "${TEST_SCHEMA}"`);

    try {
      await transaction.$executeRawUnsafe(`SET LOCAL search_path TO "${TEST_SCHEMA}"`);
      await transaction.$executeRawUnsafe(`
        CREATE TABLE "users" ("id" INTEGER PRIMARY KEY)
      `);
      await transaction.$executeRawUnsafe(`
        CREATE TABLE "MenuItem" (
          "id" INTEGER PRIMARY KEY,
          "name" TEXT NOT NULL
        )
      `);
      await transaction.$executeRawUnsafe(`
        CREATE TABLE "menu_item_prices" (
          "id" INTEGER PRIMARY KEY,
          "amount" DECIMAL(12,2) NOT NULL
        )
      `);
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
  expectedSqlState: '22001' | '23503' | '23505' | '23514',
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

async function seedReferencedRecords(transaction: Prisma.TransactionClient) {
  await transaction.$executeRaw`
    INSERT INTO "users" ("id") VALUES (101), (102), (103)
  `;
  await transaction.$executeRaw`
    INSERT INTO "MenuItem" ("id", "name")
    VALUES
      (201, 'Hamburguesa'),
      (202, 'Queso adicional'),
      (203, 'Aguacate')
  `;
  await transaction.$executeRaw`
    INSERT INTO "menu_item_prices" ("id", "amount")
    VALUES (301, 23800.00), (302, 3000.00), (303, 4500.00)
  `;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('migración SALES-02C de mesas y pedidos', () => {
  it('es aditiva y separa el ciclo del pedido de cualquier estado de Kitchen', () => {
    expect(migrationSql).not.toMatch(/^\s*(?:DROP|DELETE|UPDATE)\s/im);
    expect(migrationSql).toContain("AS ENUM ('OPEN', 'SETTLED', 'VOIDED')");
    expect(migrationSql).toContain('sales_orders_one_open_per_table_idx');
    expect(migrationSql).toContain('WHERE "status" = \'OPEN\'');
    expect(migrationSql).not.toMatch(/UNIQUE\s*\(\s*"salesOrderId"\s*,\s*"menuItemId"/i);
    expect(migrationSql).not.toMatch(
      /KitchenDispatch|kitchenStatus|sentToKitchen|kitchenSent|dispatched/i,
    );
  });

  it('permite guestCount nulo o positivo y rechaza cero o negativos', async () => {
    await withMigratedFoundation(async transaction => {
      await seedReferencedRecords(transaction);
      const tables = await transaction.$queryRaw<Array<{ id: number; code: string }>>`
        INSERT INTO "dining_tables" ("code", "capacity")
        VALUES ('G-NULL', 4), ('G-POS', 4), ('G-ZERO', 4), ('G-NEG', 4)
        RETURNING "id", "code"
      `;
      const tableIdByCode = Object.fromEntries(tables.map(table => [table.code, table.id]));

      const [withoutGuestCount] = await transaction.$queryRaw<Array<{
        guestCount: number | null;
      }>>`
        INSERT INTO "sales_orders" ("diningTableId", "openedById")
        VALUES (${tableIdByCode['G-NULL']}, 101)
        RETURNING "guestCount"
      `;
      const [withGuestCount] = await transaction.$queryRaw<Array<{ guestCount: number }>>`
        INSERT INTO "sales_orders" ("diningTableId", "openedById", "guestCount")
        VALUES (${tableIdByCode['G-POS']}, 101, 3)
        RETURNING "guestCount"
      `;

      expect(withoutGuestCount.guestCount).toBeNull();
      expect(withGuestCount.guestCount).toBe(3);
      await expectConstraintViolation(
        transaction,
        'guest_count_zero',
        `INSERT INTO "sales_orders" ("diningTableId", "openedById", "guestCount") VALUES (${tableIdByCode['G-ZERO']}, 101, 0)`,
        '23514',
      );
      await expectConstraintViolation(
        transaction,
        'guest_count_negative',
        `INSERT INTO "sales_orders" ("diningTableId", "openedById", "guestCount") VALUES (${tableIdByCode['G-NEG']}, 101, -1)`,
        '23514',
      );
    });
  });

  it('crea DiningTable con defaults y restricciones de capacidad y código', async () => {
    await withMigratedFoundation(async transaction => {
      const tables = await transaction.$queryRaw<Array<{
        code: string;
        area: string | null;
        capacity: number;
        active: boolean;
      }>>`
        INSERT INTO "dining_tables" ("code", "capacity")
        VALUES ('M-01', 4)
        RETURNING "code", "area", "capacity", "active"
      `;

      expect(tables).toEqual([{
        code: 'M-01',
        area: null,
        capacity: 4,
        active: true,
      }]);
      await expectConstraintViolation(
        transaction,
        'capacity_check',
        `INSERT INTO "dining_tables" ("code", "capacity") VALUES ('M-00', 0)`,
        '23514',
      );
      await expectConstraintViolation(
        transaction,
        'code_unique',
        `INSERT INTO "dining_tables" ("code", "capacity") VALUES ('M-01', 2)`,
        '23505',
      );
    });
  });

  it('mantiene una sola orden OPEN durante solicitud de cuenta, pago y anulación', async () => {
    await withMigratedFoundation(async transaction => {
      await seedReferencedRecords(transaction);
      const [{ id: tableId }] = await transaction.$queryRaw<Array<{ id: number }>>`
        INSERT INTO "dining_tables" ("code", "area", "capacity")
        VALUES ('M-02', 'Salón principal', 4)
        RETURNING "id"
      `;
      const [firstOrder] = await transaction.$queryRaw<Array<{
        id: number;
        status: string;
        billRequestedAt: Date | null;
        settledAt: Date | null;
        settledById: number | null;
      }>>`
        INSERT INTO "sales_orders" ("diningTableId", "openedById")
        VALUES (${tableId}, 101)
        RETURNING "id", "status"::text, "billRequestedAt", "settledAt", "settledById"
      `;

      expect(firstOrder).toMatchObject({
        status: 'OPEN',
        billRequestedAt: null,
        settledAt: null,
        settledById: null,
      });
      await expectConstraintViolation(
        transaction,
        'second_open',
        `INSERT INTO "sales_orders" ("diningTableId", "openedById") VALUES (${tableId}, 102)`,
        '23505',
      );

      await transaction.$executeRawUnsafe(`
        UPDATE "sales_orders"
        SET "billRequestedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${firstOrder.id}
      `);
      await expectConstraintViolation(
        transaction,
        'bill_requested_still_open',
        `INSERT INTO "sales_orders" ("diningTableId", "openedById") VALUES (${tableId}, 102)`,
        '23505',
      );
      await expectConstraintViolation(
        transaction,
        'settled_metadata_required',
        `UPDATE "sales_orders" SET "status" = 'SETTLED' WHERE "id" = ${firstOrder.id}`,
        '23514',
      );

      await transaction.$executeRawUnsafe(`
        UPDATE "sales_orders"
        SET "status" = 'SETTLED', "settledAt" = CURRENT_TIMESTAMP, "settledById" = 103
        WHERE "id" = ${firstOrder.id}
      `);
      const [{ id: secondOrderId }] = await transaction.$queryRaw<Array<{ id: number }>>`
        INSERT INTO "sales_orders" ("diningTableId", "openedById")
        VALUES (${tableId}, 102)
        RETURNING "id"
      `;

      await transaction.$executeRawUnsafe(`
        UPDATE "sales_orders"
        SET "status" = 'VOIDED', "voidedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${secondOrderId}
      `);
      await transaction.$executeRaw`
        INSERT INTO "sales_orders" ("diningTableId", "openedById")
        VALUES (${tableId}, 101)
      `;

      const statuses = await transaction.$queryRaw<Array<{ status: string; count: bigint }>>`
        SELECT "status"::text, COUNT(*) AS "count"
        FROM "sales_orders"
        GROUP BY "status"
        ORDER BY "status"
      `;
      expect(statuses).toEqual([
        { status: 'OPEN', count: 1n },
        { status: 'SETTLED', count: 1n },
        { status: 'VOIDED', count: 1n },
      ]);

      await expectConstraintViolation(
        transaction,
        'opener_fk',
        `INSERT INTO "sales_orders" ("diningTableId", "openedById", "status", "voidedAt") VALUES (${tableId}, 999, 'VOIDED', CURRENT_TIMESTAMP)`,
        '23503',
      );
    });
  });

  it('preserva snapshots, cantidades positivas y líneas duplicadas de MenuItem', async () => {
    await withMigratedFoundation(async transaction => {
      await seedReferencedRecords(transaction);
      const [{ id: tableId }] = await transaction.$queryRaw<Array<{ id: number }>>`
        INSERT INTO "dining_tables" ("code", "capacity")
        VALUES ('M-03', 2)
        RETURNING "id"
      `;
      const [{ id: orderId }] = await transaction.$queryRaw<Array<{ id: number }>>`
        INSERT INTO "sales_orders" ("diningTableId", "openedById")
        VALUES (${tableId}, 101)
        RETURNING "id"
      `;

      const [principalItem] = await transaction.$queryRaw<Array<{
        id: number;
        parentItemId: number | null;
        specialInstructions: string | null;
      }>>`
        INSERT INTO "sales_order_items" (
          "salesOrderId",
          "menuItemId",
          "menuItemPriceId",
          "menuItemNameSnapshot",
          "quantity",
          "specialInstructions",
          "unitPriceSnapshot",
          "currencySnapshot",
          "taxIncludedSnapshot",
          "addedById"
        )
        VALUES (
          ${orderId}, 201, 301, 'Hamburguesa', 2, 'Sin cebolla',
          23800.00, 'COP', true, 102
        )
        RETURNING "id", "parentItemId", "specialInstructions"
      `;
      expect(principalItem).toMatchObject({
        parentItemId: null,
        specialInstructions: 'Sin cebolla',
      });
      await transaction.$executeRaw`
        UPDATE "MenuItem" SET "name" = 'Hamburguesa renombrada' WHERE "id" = 201
      `;
      await transaction.$executeRaw`
        UPDATE "menu_item_prices" SET "amount" = 25000.00 WHERE "id" = 301
      `;

      const snapshots = await transaction.$queryRaw<Array<{
        menuItemNameSnapshot: string;
        unitPriceSnapshot: string;
        currencySnapshot: string;
        taxIncludedSnapshot: boolean;
      }>>`
        SELECT
          "menuItemNameSnapshot",
          "unitPriceSnapshot"::text,
          "currencySnapshot",
          "taxIncludedSnapshot"
        FROM "sales_order_items"
      `;
      expect(snapshots).toEqual([{
        menuItemNameSnapshot: 'Hamburguesa',
        unitPriceSnapshot: '23800.00',
        currencySnapshot: 'COP',
        taxIncludedSnapshot: true,
      }]);

      await transaction.$executeRaw`
        INSERT INTO "sales_order_items" (
          "salesOrderId",
          "menuItemId",
          "menuItemPriceId",
          "menuItemNameSnapshot",
          "quantity",
          "specialInstructions",
          "unitPriceSnapshot",
          "currencySnapshot",
          "taxIncludedSnapshot",
          "addedById"
        )
        VALUES (
          ${orderId}, 201, 301, 'Hamburguesa renombrada', 1, 'Sin tomate',
          25000.00, 'COP', true, 102
        )
      `;
      const [{ count }] = await transaction.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS "count" FROM "sales_order_items"
        WHERE "salesOrderId" = ${orderId} AND "menuItemId" = 201
      `;
      expect(count).toBe(2n);

      await transaction.$executeRaw`
        INSERT INTO "sales_order_items" (
          "salesOrderId",
          "menuItemId",
          "menuItemPriceId",
          "menuItemNameSnapshot",
          "quantity",
          "specialInstructions",
          "unitPriceSnapshot",
          "currencySnapshot",
          "taxIncludedSnapshot",
          "addedById",
          "parentItemId"
        )
        VALUES
          (${orderId}, 202, 302, 'Queso adicional', 1, NULL, 3000.00, 'COP', true, 102, ${principalItem.id}),
          (${orderId}, 203, 303, 'Aguacate', 2, 'Salsa aparte', 4500.00, 'COP', true, 102, ${principalItem.id})
      `;
      const additions = await transaction.$queryRaw<Array<{
        name: string;
        parentId: number;
        instructions: string | null;
      }>>`
        SELECT
          child."menuItemNameSnapshot" AS "name",
          parent."id" AS "parentId",
          child."specialInstructions" AS "instructions"
        FROM "sales_order_items" AS child
        JOIN "sales_order_items" AS parent ON parent."id" = child."parentItemId"
        WHERE child."parentItemId" = ${principalItem.id}
        ORDER BY child."menuItemNameSnapshot"
      `;
      expect(additions).toEqual([
        { name: 'Aguacate', parentId: principalItem.id, instructions: 'Salsa aparte' },
        { name: 'Queso adicional', parentId: principalItem.id, instructions: null },
      ]);

      await expectConstraintViolation(
        transaction,
        'parent_not_self',
        `UPDATE "sales_order_items" SET "parentItemId" = "id" WHERE "id" = ${principalItem.id}`,
        '23514',
      );

      await expectConstraintViolation(
        transaction,
        'instructions_length',
        `INSERT INTO "sales_order_items" ("salesOrderId", "menuItemId", "menuItemPriceId", "menuItemNameSnapshot", "quantity", "specialInstructions", "unitPriceSnapshot", "currencySnapshot", "taxIncludedSnapshot", "addedById") VALUES (${orderId}, 201, 301, 'Inválido', 1, repeat('x', 501), 23800.00, 'COP', true, 102)`,
        '22001',
      );

      await expectConstraintViolation(
        transaction,
        'quantity_positive',
        `INSERT INTO "sales_order_items" ("salesOrderId", "menuItemId", "menuItemPriceId", "menuItemNameSnapshot", "quantity", "unitPriceSnapshot", "currencySnapshot", "taxIncludedSnapshot", "addedById") VALUES (${orderId}, 201, 301, 'Inválido', 0, 23800.00, 'COP', true, 102)`,
        '23514',
      );
      await expectConstraintViolation(
        transaction,
        'quantity_negative',
        `INSERT INTO "sales_order_items" ("salesOrderId", "menuItemId", "menuItemPriceId", "menuItemNameSnapshot", "quantity", "unitPriceSnapshot", "currencySnapshot", "taxIncludedSnapshot", "addedById") VALUES (${orderId}, 201, 301, 'Inválido', -1, 23800.00, 'COP', true, 102)`,
        '23514',
      );
      await expectConstraintViolation(
        transaction,
        'order_fk',
        `INSERT INTO "sales_order_items" ("salesOrderId", "menuItemId", "menuItemPriceId", "menuItemNameSnapshot", "quantity", "unitPriceSnapshot", "currencySnapshot", "taxIncludedSnapshot", "addedById") VALUES (999, 201, 301, 'Inválido', 1, 23800.00, 'COP', true, 102)`,
        '23503',
      );
      await expectConstraintViolation(
        transaction,
        'menu_item_fk',
        `INSERT INTO "sales_order_items" ("salesOrderId", "menuItemId", "menuItemPriceId", "menuItemNameSnapshot", "quantity", "unitPriceSnapshot", "currencySnapshot", "taxIncludedSnapshot", "addedById") VALUES (${orderId}, 999, 301, 'Inválido', 1, 23800.00, 'COP', true, 102)`,
        '23503',
      );
      await expectConstraintViolation(
        transaction,
        'price_fk',
        `INSERT INTO "sales_order_items" ("salesOrderId", "menuItemId", "menuItemPriceId", "menuItemNameSnapshot", "quantity", "unitPriceSnapshot", "currencySnapshot", "taxIncludedSnapshot", "addedById") VALUES (${orderId}, 201, 999, 'Inválido', 1, 23800.00, 'COP', true, 102)`,
        '23503',
      );
      await expectConstraintViolation(
        transaction,
        'added_by_fk',
        `INSERT INTO "sales_order_items" ("salesOrderId", "menuItemId", "menuItemPriceId", "menuItemNameSnapshot", "quantity", "unitPriceSnapshot", "currencySnapshot", "taxIncludedSnapshot", "addedById") VALUES (${orderId}, 201, 301, 'Inválido', 1, 23800.00, 'COP', true, 999)`,
        '23503',
      );
    });
  });

  it('registra sales.manage idempotentemente solo para admin y super existentes', async () => {
    await withMigratedFoundation(async transaction => {
      for (const statement of migrationStatements.slice(-2)) {
        await transaction.$executeRawUnsafe(statement);
      }

      const permissions = await transaction.$queryRaw<Array<{ name: string }>>`
        SELECT "name" FROM "permissions" WHERE "name" = 'sales.manage'
      `;
      const grants = await transaction.$queryRaw<Array<{ roleName: string }>>`
        SELECT r."name" AS "roleName"
        FROM "role_permissions" AS rp
        JOIN "roles" AS r ON r."id" = rp."roleId"
        JOIN "permissions" AS p ON p."id" = rp."permissionId"
        WHERE p."name" = 'sales.manage'
        ORDER BY r."name"
      `;

      expect(permissions).toEqual([{ name: 'sales.manage' }]);
      expect(grants).toEqual([{ roleName: 'admin' }, { roleName: 'super' }]);
    });
  });
});
