CREATE TABLE "global_waste_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "wastePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_waste_config_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "global_waste_config_singleton_check" CHECK ("id" = 1),
    CONSTRAINT "global_waste_config_percent_check" CHECK ("wastePercent" >= 0 AND "wastePercent" <= 100)
);

CREATE TABLE "global_waste_config_audits" (
    "id" SERIAL NOT NULL,
    "configId" INTEGER NOT NULL,
    "previousPercent" DECIMAL(5,2) NOT NULL,
    "newPercent" DECIMAL(5,2) NOT NULL,
    "changedById" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_waste_config_audits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "global_waste_config_audits_previous_percent_check" CHECK ("previousPercent" >= 0 AND "previousPercent" <= 100),
    CONSTRAINT "global_waste_config_audits_new_percent_check" CHECK ("newPercent" >= 0 AND "newPercent" <= 100)
);

CREATE TABLE "kitchen_inventory_consumptions" (
    "id" SERIAL NOT NULL,
    "kitchenDispatchId" INTEGER NOT NULL,
    "warehouseId" INTEGER,
    "wastePercentSnapshot" DECIMAL(5,2) NOT NULL,
    "theoreticalCost" DECIMAL(18,4) NOT NULL,
    "wasteCost" DECIMAL(18,4) NOT NULL,
    "totalCost" DECIMAL(18,4) NOT NULL,
    "issues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kitchen_inventory_consumptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "kitchen_inventory_consumptions_waste_percent_check" CHECK ("wastePercentSnapshot" >= 0 AND "wastePercentSnapshot" <= 100),
    CONSTRAINT "kitchen_inventory_consumptions_costs_check" CHECK ("theoreticalCost" >= 0 AND "wasteCost" >= 0 AND "totalCost" >= 0)
);

CREATE TABLE "kitchen_inventory_consumption_items" (
    "id" SERIAL NOT NULL,
    "consumptionId" INTEGER NOT NULL,
    "kitchenDispatchItemId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "recipeId" INTEGER,
    "inventoryMovementId" INTEGER NOT NULL,
    "theoreticalQuantity" DECIMAL(18,6) NOT NULL,
    "adjustedQuantity" DECIMAL(18,6) NOT NULL,
    "unit" "ProductBaseUnit" NOT NULL,
    "unitCostSnapshot" DECIMAL(18,6) NOT NULL,
    "theoreticalCost" DECIMAL(18,4) NOT NULL,
    "wasteCost" DECIMAL(18,4) NOT NULL,
    "totalCost" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kitchen_inventory_consumption_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "kitchen_inventory_consumption_items_quantities_check" CHECK ("theoreticalQuantity" > 0 AND "adjustedQuantity" > 0),
    CONSTRAINT "kitchen_inventory_consumption_items_costs_check" CHECK ("unitCostSnapshot" >= 0 AND "theoreticalCost" >= 0 AND "wasteCost" >= 0 AND "totalCost" >= 0)
);

CREATE UNIQUE INDEX "kitchen_inventory_consumptions_kitchenDispatchId_key"
ON "kitchen_inventory_consumptions"("kitchenDispatchId");

CREATE INDEX "kitchen_inventory_consumptions_warehouseId_createdAt_idx"
ON "kitchen_inventory_consumptions"("warehouseId", "createdAt");

CREATE UNIQUE INDEX "kitchen_inventory_consumption_items_inventoryMovementId_key"
ON "kitchen_inventory_consumption_items"("inventoryMovementId");

CREATE UNIQUE INDEX "kitchen_inventory_consumption_items_consumptionId_kitchenDispatchItemId_productId_key"
ON "kitchen_inventory_consumption_items"("consumptionId", "kitchenDispatchItemId", "productId");

CREATE INDEX "kitchen_inventory_consumption_items_productId_createdAt_idx"
ON "kitchen_inventory_consumption_items"("productId", "createdAt");

CREATE INDEX "kitchen_inventory_consumption_items_recipeId_idx"
ON "kitchen_inventory_consumption_items"("recipeId");

CREATE INDEX "global_waste_config_audits_configId_changedAt_idx"
ON "global_waste_config_audits"("configId", "changedAt");

ALTER TABLE "global_waste_config"
ADD CONSTRAINT "global_waste_config_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "global_waste_config_audits"
ADD CONSTRAINT "global_waste_config_audits_configId_fkey"
FOREIGN KEY ("configId") REFERENCES "global_waste_config"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "global_waste_config_audits"
ADD CONSTRAINT "global_waste_config_audits_changedById_fkey"
FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kitchen_inventory_consumptions"
ADD CONSTRAINT "kitchen_inventory_consumptions_kitchenDispatchId_fkey"
FOREIGN KEY ("kitchenDispatchId") REFERENCES "kitchen_dispatches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kitchen_inventory_consumptions"
ADD CONSTRAINT "kitchen_inventory_consumptions_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kitchen_inventory_consumption_items"
ADD CONSTRAINT "kitchen_inventory_consumption_items_consumptionId_fkey"
FOREIGN KEY ("consumptionId") REFERENCES "kitchen_inventory_consumptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kitchen_inventory_consumption_items"
ADD CONSTRAINT "kitchen_inventory_consumption_items_kitchenDispatchItemId_fkey"
FOREIGN KEY ("kitchenDispatchItemId") REFERENCES "kitchen_dispatch_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kitchen_inventory_consumption_items"
ADD CONSTRAINT "kitchen_inventory_consumption_items_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kitchen_inventory_consumption_items"
ADD CONSTRAINT "kitchen_inventory_consumption_items_recipeId_fkey"
FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kitchen_inventory_consumption_items"
ADD CONSTRAINT "kitchen_inventory_consumption_items_inventoryMovementId_fkey"
FOREIGN KEY ("inventoryMovementId") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "global_waste_config" ("id", "wastePercent", "createdAt", "updatedAt")
VALUES (1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
