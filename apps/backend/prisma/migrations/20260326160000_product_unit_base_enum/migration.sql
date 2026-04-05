-- CreateEnum
CREATE TYPE "ProductBaseUnit" AS ENUM ('g', 'ml', 'und');

-- AlterTable
ALTER TABLE "products"
ALTER COLUMN "unitOfMeasure" TYPE "ProductBaseUnit"
USING (
  CASE
    WHEN LOWER(TRIM("unitOfMeasure")) IN ('g', 'gr', 'gramo', 'gramos', 'kg', 'kilo', 'kilos', 'lb', 'libra', 'libras', 'oz', 'onza', 'onzas')
      THEN 'g'::"ProductBaseUnit"
    WHEN LOWER(TRIM("unitOfMeasure")) IN ('ml', 'mililitro', 'mililitros', 'l', 'lt', 'litro', 'litros', 'gal', 'galon', 'galones', 'fl oz')
      THEN 'ml'::"ProductBaseUnit"
    WHEN LOWER(TRIM("unitOfMeasure")) IN ('und', 'unidad', 'unidades', 'pza', 'pieza', 'piezas', 'doc', 'docena', 'docenas', 'paca', 'caja', 'bolsa')
      THEN 'und'::"ProductBaseUnit"
    ELSE 'und'::"ProductBaseUnit"
  END
);
