ALTER TABLE "warehouses"
ADD COLUMN "purchaseReceiving" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "kitchenConsumption" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "barConsumption" BOOLEAN NOT NULL DEFAULT false;

-- Compatibilidad: isMain conserva su significado histórico, pero solo permite
-- inferir recepción de compras cuando existe una única principal activa.
UPDATE "warehouses"
SET "purchaseReceiving" = true
WHERE "id" IN (
  SELECT MIN("id")
  FROM "warehouses"
  WHERE "active" = true AND "isMain" = true
  HAVING COUNT(*) = 1
);

CREATE UNIQUE INDEX "warehouses_one_active_purchase_receiving_idx"
ON "warehouses" ("purchaseReceiving")
WHERE "active" = true AND "purchaseReceiving" = true;

CREATE UNIQUE INDEX "warehouses_one_active_kitchen_consumption_idx"
ON "warehouses" ("kitchenConsumption")
WHERE "active" = true AND "kitchenConsumption" = true;

CREATE UNIQUE INDEX "warehouses_one_active_bar_consumption_idx"
ON "warehouses" ("barConsumption")
WHERE "active" = true AND "barConsumption" = true;
