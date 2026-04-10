-- P2032: Prisma espera String pero PostgreSQL puede tener char/bpchar/enum u otro tipo drifted.
-- Fuerza TEXT en columnas de texto del catálogo de productos.
ALTER TABLE "products" ALTER COLUMN "internalCode" TYPE TEXT USING "internalCode"::text;
ALTER TABLE "products" ALTER COLUMN "name" TYPE TEXT USING "name"::text;
ALTER TABLE "products" ALTER COLUMN "category" TYPE TEXT USING COALESCE("category", '')::text;
ALTER TABLE "products" ALTER COLUMN "presentation" TYPE TEXT USING "presentation"::text;
ALTER TABLE "products" ALTER COLUMN "unitOfMeasure" TYPE TEXT USING "unitOfMeasure"::text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'inputUnit'
  ) THEN
    ALTER TABLE "products" ALTER COLUMN "inputUnit" TYPE TEXT USING "inputUnit"::text;
  END IF;
END $$;
