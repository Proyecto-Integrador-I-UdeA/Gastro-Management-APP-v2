-- Add soft-delete flag to suppliers/products
-- When active = false, records are treated as "inactivated" by the API and hidden in lists.

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

