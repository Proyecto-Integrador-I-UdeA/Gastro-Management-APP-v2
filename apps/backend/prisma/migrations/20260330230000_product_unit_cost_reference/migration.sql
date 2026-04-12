-- Referencia de costo en producto (alineado con Product.unitCost Float en Prisma → double precision)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
