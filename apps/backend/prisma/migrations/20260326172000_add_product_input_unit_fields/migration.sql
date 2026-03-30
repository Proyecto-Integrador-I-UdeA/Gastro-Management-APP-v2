-- AlterTable
ALTER TABLE "products"
ADD COLUMN "inputUnit" TEXT NOT NULL DEFAULT 'g',
ADD COLUMN "inputUnitQuantity" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- Backfill from base unit (legacy rows)
UPDATE "products"
SET "inputUnit" = CASE
  WHEN "unitOfMeasure" = 'g' THEN 'g'
  WHEN "unitOfMeasure" = 'ml' THEN 'ml'
  ELSE 'und'
END;
