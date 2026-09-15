-- Extensión aditiva. ADJUSTMENT se usa únicamente a través del posting del conteo.
ALTER TYPE "MovementType" ADD VALUE 'ADJUSTMENT';
CREATE TYPE "InventoryPhysicalCountStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

CREATE TABLE "inventory_physical_counts" (
  "id" SERIAL PRIMARY KEY,
  "warehouseId" INTEGER NOT NULL REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "status" "InventoryPhysicalCountStatus" NOT NULL DEFAULT 'DRAFT',
  "reason" TEXT NOT NULL DEFAULT 'PHYSICAL_COUNT',
  "notes" TEXT,
  "createdById" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "updatedById" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "postedById" INTEGER REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "cancelledById" INTEGER REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "postedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  CONSTRAINT "physical_counts_reason_check" CHECK ("reason" IN (
    'PHYSICAL_COUNT', 'UNRECORDED_ENTRY', 'WASTE_OR_YIELD_VARIANCE',
    'DAMAGE_OR_LOSS', 'DATA_CORRECTION', 'OTHER'
  )),
  CONSTRAINT "physical_counts_lifecycle_check" CHECK (
    ("status" = 'DRAFT' AND "postedAt" IS NULL AND "postedById" IS NULL AND "cancelledAt" IS NULL AND "cancelledById" IS NULL)
    OR ("status" = 'POSTED' AND "postedAt" IS NOT NULL AND "postedById" IS NOT NULL AND "cancelledAt" IS NULL AND "cancelledById" IS NULL)
    OR ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL AND "cancelledById" IS NOT NULL AND "postedAt" IS NULL AND "postedById" IS NULL)
  )
);
CREATE INDEX "inventory_physical_counts_warehouseId_createdAt_idx" ON "inventory_physical_counts"("warehouseId", "createdAt");
CREATE INDEX "inventory_physical_counts_status_createdAt_idx" ON "inventory_physical_counts"("status", "createdAt");

CREATE TABLE "inventory_physical_count_items" (
  "id" SERIAL PRIMARY KEY,
  "physicalCountId" INTEGER NOT NULL REFERENCES "inventory_physical_counts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "productId" INTEGER NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "systemQuantitySnapshot" DOUBLE PRECISION NOT NULL,
  "countedQuantity" DOUBLE PRECISION,
  "varianceQuantity" DOUBLE PRECISION,
  "unit" "ProductBaseUnit" NOT NULL,
  "unitCostSnapshot" DECIMAL(24,12) NOT NULL,
  "estimatedValueVariance" DECIMAL(30,12),
  "inventoryMovementId" INTEGER REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "physical_count_items_system_finite_check" CHECK ("systemQuantitySnapshot" > '-Infinity'::float8 AND "systemQuantitySnapshot" < 'Infinity'::float8),
  CONSTRAINT "physical_count_items_counted_check" CHECK ("countedQuantity" IS NULL OR ("countedQuantity" >= 0 AND "countedQuantity" < 'Infinity'::float8)),
  CONSTRAINT "physical_count_items_variance_check" CHECK ("varianceQuantity" IS NULL OR ("varianceQuantity" > '-Infinity'::float8 AND "varianceQuantity" < 'Infinity'::float8)),
  CONSTRAINT "physical_count_items_cost_check" CHECK ("unitCostSnapshot" >= 0 AND "unitCostSnapshot" < 'Infinity'::numeric),
  CONSTRAINT "physical_count_items_value_finite_check" CHECK ("estimatedValueVariance" IS NULL OR ("estimatedValueVariance" > '-Infinity'::numeric AND "estimatedValueVariance" < 'Infinity'::numeric))
);
CREATE UNIQUE INDEX "inventory_physical_count_items_physicalCountId_productId_key" ON "inventory_physical_count_items"("physicalCountId", "productId");
CREATE UNIQUE INDEX "inventory_physical_count_items_inventoryMovementId_key" ON "inventory_physical_count_items"("inventoryMovementId");
