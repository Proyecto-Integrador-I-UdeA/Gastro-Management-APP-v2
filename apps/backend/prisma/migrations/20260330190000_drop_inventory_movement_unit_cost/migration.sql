-- Costo unitario solo en products; no duplicar en movimientos
ALTER TABLE "inventory_movements" DROP COLUMN IF EXISTS "unitCost";
