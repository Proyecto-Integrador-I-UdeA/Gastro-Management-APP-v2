-- Alinear tablas de recetas con schema.prisma (campos añadidos al modelo sin migración previa).
--
-- Producción: no elimina datos ni tablas. ADD COLUMN / CREATE INDEX usan IF NOT EXISTS; el UPDATE
-- solo toca filas con internalCode NULL. Si prod ya tiene las columnas y datos, casi todo es no-op.
-- Único riesgo: ALTER ... SET NOT NULL falla si quedara algún internalCode NULL (poco probable si ya usan el módulo).
-- Si en prod ya está todo aplicado y quieren marcar la migración sin ejecutar SQL: migrate resolve --applied 20260330240000_recipe_schema_align

-- recipes: internalCode + active
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "internalCode" TEXT;
UPDATE "recipes"
SET "internalCode" = 'R-' || LPAD(id::text, 4, '0')
WHERE "internalCode" IS NULL;
ALTER TABLE "recipes" ALTER COLUMN "internalCode" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "recipes_internalCode_key" ON "recipes"("internalCode");

ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

-- recipe_processes: order (stepOrder), stepDescription
ALTER TABLE "recipe_processes" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "recipe_processes" ADD COLUMN IF NOT EXISTS "stepDescription" TEXT;
