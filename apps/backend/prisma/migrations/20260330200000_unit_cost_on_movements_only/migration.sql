-- Costo unitario solo en movimientos; copiar desde producto en compras sin costo y quitar columna en products.

ALTER TABLE "inventory_movements" ADD COLUMN IF NOT EXISTS "unitCost" DECIMAL(10,2);

UPDATE "inventory_movements" AS im
SET "unitCost" = p."unitCost"
FROM "products" AS p
WHERE im."productId" = p.id
  AND im.type::text = 'PURCHASE'
  AND im."unitCost" IS NULL
  AND p."unitCost" IS NOT NULL;

ALTER TABLE "products" DROP COLUMN IF EXISTS "unitCost";
