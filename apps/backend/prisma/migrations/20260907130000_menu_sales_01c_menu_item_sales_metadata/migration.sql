-- CreateEnum
CREATE TYPE "MenuItemKind" AS ENUM ('STANDARD', 'ADDITION');

-- AlterTable
ALTER TABLE "MenuItem"
ADD COLUMN "kind" "MenuItemKind" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN "available" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "includedItemsText" VARCHAR(500);
