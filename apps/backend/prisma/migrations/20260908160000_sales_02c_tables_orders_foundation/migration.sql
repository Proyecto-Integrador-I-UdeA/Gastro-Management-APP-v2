-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('OPEN', 'SETTLED', 'VOIDED');

-- CreateTable
CREATE TABLE "dining_tables" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "area" TEXT,
    "capacity" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dining_tables_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "dining_tables_capacity_check" CHECK ("capacity" > 0)
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" SERIAL NOT NULL,
    "diningTableId" INTEGER NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'OPEN',
    "openedById" INTEGER NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guestCount" INTEGER,
    "billRequestedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "settledById" INTEGER,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sales_orders_guestCount_check" CHECK ("guestCount" IS NULL OR "guestCount" > 0),
    CONSTRAINT "sales_orders_status_timestamps_check" CHECK (
        ("status" = 'OPEN' AND "settledAt" IS NULL AND "settledById" IS NULL AND "voidedAt" IS NULL)
        OR ("status" = 'SETTLED' AND "settledAt" IS NOT NULL AND "settledById" IS NOT NULL AND "voidedAt" IS NULL)
        OR ("status" = 'VOIDED' AND "settledAt" IS NULL AND "settledById" IS NULL AND "voidedAt" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "sales_order_items" (
    "id" SERIAL NOT NULL,
    "salesOrderId" INTEGER NOT NULL,
    "menuItemId" INTEGER NOT NULL,
    "menuItemPriceId" INTEGER NOT NULL,
    "menuItemNameSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "specialInstructions" VARCHAR(500),
    "unitPriceSnapshot" DECIMAL(12,2) NOT NULL,
    "currencySnapshot" VARCHAR(3) NOT NULL,
    "taxIncludedSnapshot" BOOLEAN NOT NULL,
    "addedById" INTEGER NOT NULL,
    "parentItemId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sales_order_items_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "sales_order_items_parent_not_self_check" CHECK ("parentItemId" IS NULL OR "parentItemId" <> "id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dining_tables_code_key" ON "dining_tables"("code");

-- CreateIndex
CREATE INDEX "sales_orders_diningTableId_idx" ON "sales_orders"("diningTableId");

-- CreateIndex
CREATE INDEX "sales_orders_status_idx" ON "sales_orders"("status");

-- SQL-only partial unique index: occupancy is derived from the single OPEN order.
CREATE UNIQUE INDEX "sales_orders_one_open_per_table_idx"
ON "sales_orders"("diningTableId")
WHERE "status" = 'OPEN';

-- CreateIndex
CREATE INDEX "sales_order_items_salesOrderId_idx" ON "sales_order_items"("salesOrderId");

-- CreateIndex
CREATE INDEX "sales_order_items_menuItemId_idx" ON "sales_order_items"("menuItemId");

-- CreateIndex
CREATE INDEX "sales_order_items_parentItemId_idx" ON "sales_order_items"("parentItemId");

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_diningTableId_fkey" FOREIGN KEY ("diningTableId") REFERENCES "dining_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_settledById_fkey" FOREIGN KEY ("settledById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_menuItemPriceId_fkey" FOREIGN KEY ("menuItemPriceId") REFERENCES "menu_item_prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_parentItemId_fkey" FOREIGN KEY ("parentItemId") REFERENCES "sales_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Register the operational Sales write permission without depending on seed execution.
INSERT INTO "permissions" ("name", "description", "createdAt", "updatedAt")
VALUES (
    'sales.manage',
    'Administrar mesas y pedidos de venta',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO NOTHING;

-- Grant Sales management only to existing super/admin roles.
INSERT INTO "role_permissions" ("roleId", "permissionId", "createdAt", "updatedAt")
SELECT
    r."id",
    p."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "roles" AS r
CROSS JOIN "permissions" AS p
WHERE r."name" IN ('super', 'admin')
  AND p."name" = 'sales.manage'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
