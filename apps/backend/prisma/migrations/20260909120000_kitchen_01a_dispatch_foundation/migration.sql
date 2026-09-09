-- CreateEnum
CREATE TYPE "KitchenDispatchStatus" AS ENUM ('NEXT', 'PREPARING', 'READY');

-- CreateTable
CREATE TABLE "kitchen_dispatches" (
    "id" SERIAL NOT NULL,
    "salesOrderId" INTEGER NOT NULL,
    "status" "KitchenDispatchStatus" NOT NULL DEFAULT 'NEXT',
    "dispatchedById" INTEGER NOT NULL,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prepTimeMinutesSnapshot" INTEGER NOT NULL DEFAULT 15,
    "targetReadyAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kitchen_dispatches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "kitchen_dispatches_prep_time_check" CHECK ("prepTimeMinutesSnapshot" > 0),
    CONSTRAINT "kitchen_dispatches_target_ready_check" CHECK ("targetReadyAt" > "dispatchedAt"),
    CONSTRAINT "kitchen_dispatches_status_timestamps_check" CHECK (
        ("status" = 'NEXT' AND "startedAt" IS NULL AND "readyAt" IS NULL)
        OR ("status" = 'PREPARING' AND "startedAt" IS NOT NULL AND "readyAt" IS NULL)
        OR ("status" = 'READY' AND "startedAt" IS NOT NULL AND "readyAt" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "kitchen_dispatch_items" (
    "id" SERIAL NOT NULL,
    "kitchenDispatchId" INTEGER NOT NULL,
    "salesOrderItemId" INTEGER NOT NULL,
    "parentDispatchItemId" INTEGER,
    "itemNameSnapshot" TEXT NOT NULL,
    "quantitySnapshot" INTEGER NOT NULL,
    "specialInstructionsSnapshot" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kitchen_dispatch_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "kitchen_dispatch_items_quantity_check" CHECK ("quantitySnapshot" > 0),
    CONSTRAINT "kitchen_dispatch_items_parent_not_self_check" CHECK (
        "parentDispatchItemId" IS NULL OR "parentDispatchItemId" <> "id"
    )
);

-- CreateIndex
CREATE INDEX "kitchen_dispatches_salesOrderId_idx"
ON "kitchen_dispatches"("salesOrderId");

-- Deterministic queue order: NEXT, PREPARING, READY, then oldest ticket first.
CREATE INDEX "kitchen_dispatches_status_dispatchedAt_id_idx"
ON "kitchen_dispatches"("status", "dispatchedAt", "id");

-- One SalesOrderItem can be sent to Kitchen at most once.
CREATE UNIQUE INDEX "kitchen_dispatch_items_salesOrderItemId_key"
ON "kitchen_dispatch_items"("salesOrderItemId");

CREATE INDEX "kitchen_dispatch_items_kitchenDispatchId_idx"
ON "kitchen_dispatch_items"("kitchenDispatchId");

CREATE INDEX "kitchen_dispatch_items_parentDispatchItemId_idx"
ON "kitchen_dispatch_items"("parentDispatchItemId");

-- Supports the composite parent FK that keeps each hierarchy inside one dispatch.
CREATE UNIQUE INDEX "kitchen_dispatch_items_id_kitchenDispatchId_key"
ON "kitchen_dispatch_items"("id", "kitchenDispatchId");

-- AddForeignKey
ALTER TABLE "kitchen_dispatches"
ADD CONSTRAINT "kitchen_dispatches_salesOrderId_fkey"
FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kitchen_dispatches"
ADD CONSTRAINT "kitchen_dispatches_dispatchedById_fkey"
FOREIGN KEY ("dispatchedById") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kitchen_dispatch_items"
ADD CONSTRAINT "kitchen_dispatch_items_kitchenDispatchId_fkey"
FOREIGN KEY ("kitchenDispatchId") REFERENCES "kitchen_dispatches"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kitchen_dispatch_items"
ADD CONSTRAINT "kitchen_dispatch_items_salesOrderItemId_fkey"
FOREIGN KEY ("salesOrderItemId") REFERENCES "sales_order_items"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kitchen_dispatch_items"
ADD CONSTRAINT "kitchen_dispatch_items_parentDispatchItemId_fkey"
FOREIGN KEY ("parentDispatchItemId", "kitchenDispatchId")
REFERENCES "kitchen_dispatch_items"("id", "kitchenDispatchId")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Register Kitchen permissions without depending on seed execution.
INSERT INTO "permissions" ("name", "description", "createdAt", "updatedAt")
VALUES
    (
        'kitchen.read',
        'Consultar cola y detalle de cocina',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'kitchen.manage',
        'Administrar estados de preparación en cocina',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT ("name") DO NOTHING;

-- Grant Kitchen operation only to existing super, admin and chef roles.
INSERT INTO "role_permissions" ("roleId", "permissionId", "createdAt", "updatedAt")
SELECT
    r."id",
    p."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "roles" AS r
CROSS JOIN "permissions" AS p
WHERE r."name" IN ('super', 'admin', 'chef')
  AND p."name" IN ('kitchen.read', 'kitchen.manage')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
