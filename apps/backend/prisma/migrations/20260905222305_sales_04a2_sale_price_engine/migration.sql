-- CreateTable
CREATE TABLE "menu_item_prices" (
    "id" SERIAL NOT NULL,
    "menuItemId" INTEGER NOT NULL,
    "baseCostSnapshot" DECIMAL(14,4) NOT NULL,
    "indirectCostSnapshot" DECIMAL(14,4) NOT NULL,
    "totalCostSnapshot" DECIMAL(14,4) NOT NULL,
    "marginRate" DECIMAL(9,6) NOT NULL,
    "taxRate" DECIMAL(9,6) NOT NULL,
    "priceBeforeTax" DECIMAL(14,4) NOT NULL,
    "taxAmount" DECIMAL(14,4) NOT NULL,
    "calculatedAmount" DECIMAL(14,4) NOT NULL,
    "roundingIncrement" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'COP',
    "taxIncluded" BOOLEAN NOT NULL DEFAULT true,
    "calculationVersion" VARCHAR(32) NOT NULL,
    "createdById" INTEGER NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_item_prices_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraints
ALTER TABLE "menu_item_prices"
ADD CONSTRAINT "menu_item_prices_amount_positive_check" CHECK ("amount" > 0),
ADD CONSTRAINT "menu_item_prices_baseCostSnapshot_nonnegative_check" CHECK ("baseCostSnapshot" >= 0),
ADD CONSTRAINT "menu_item_prices_indirectCostSnapshot_nonnegative_check" CHECK ("indirectCostSnapshot" >= 0),
ADD CONSTRAINT "menu_item_prices_totalCostSnapshot_nonnegative_check" CHECK ("totalCostSnapshot" >= 0),
ADD CONSTRAINT "menu_item_prices_marginRate_range_check" CHECK ("marginRate" >= 0 AND "marginRate" < 1),
ADD CONSTRAINT "menu_item_prices_taxRate_range_check" CHECK ("taxRate" >= 0 AND "taxRate" <= 1),
ADD CONSTRAINT "menu_item_prices_roundingIncrement_positive_check" CHECK ("roundingIncrement" > 0),
ADD CONSTRAINT "menu_item_prices_validity_range_check" CHECK ("validUntil" IS NULL OR "validUntil" > "validFrom");

-- CreateIndex
CREATE INDEX "menu_item_prices_menuItemId_validFrom_idx" ON "menu_item_prices"("menuItemId", "validFrom");

-- CreatePartialUniqueIndex
CREATE UNIQUE INDEX "menu_item_prices_one_open_per_menu_item_idx"
ON "menu_item_prices" ("menuItemId")
WHERE "validUntil" IS NULL;

-- AddForeignKey
ALTER TABLE "menu_item_prices" ADD CONSTRAINT "menu_item_prices_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_prices" ADD CONSTRAINT "menu_item_prices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reconcile sale-price permissions in existing databases without removing current grants.
INSERT INTO "permissions" ("name", "description", "createdAt", "updatedAt")
VALUES
    ('costs.prices.read', 'Consultar precios de venta', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('costs.prices.manage', 'Calcular y actualizar precios de venta', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId", "createdAt", "updatedAt")
SELECT
    r."id",
    p."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "roles" AS r
CROSS JOIN "permissions" AS p
WHERE (
    r."name" IN ('super', 'admin')
    AND p."name" IN ('costs.prices.read', 'costs.prices.manage')
  ) OR (
    r."name" = 'accounting'
    AND p."name" = 'costs.prices.read'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
