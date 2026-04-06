-- Marca de bodega principal (una sola a nivel de aplicación).

ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "isMain" BOOLEAN NOT NULL DEFAULT false;

UPDATE "warehouses" SET "isMain" = true WHERE "name" = 'Bodega Principal';
