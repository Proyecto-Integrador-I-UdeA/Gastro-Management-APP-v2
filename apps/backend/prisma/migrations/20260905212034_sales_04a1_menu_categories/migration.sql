-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "categoryId" INTEGER;

-- CreateTable
CREATE TABLE "menu_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id")
);

-- AddCheckConstraint
ALTER TABLE "menu_categories"
ADD CONSTRAINT "menu_categories_displayOrder_nonnegative_check"
CHECK ("displayOrder" >= 0);

-- CreateIndex
CREATE UNIQUE INDEX "menu_categories_normalizedName_key" ON "menu_categories"("normalizedName");

-- CreateIndex
CREATE INDEX "menu_categories_active_displayOrder_idx" ON "menu_categories"("active", "displayOrder");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "menu_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reconcile menu permissions in existing databases without removing current grants.
INSERT INTO "permissions" ("name", "description", "createdAt", "updatedAt")
VALUES
    ('menu.read', 'Consultar menú y categorías', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('menu.manage', 'Administrar menú y categorías', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId", "createdAt", "updatedAt")
SELECT
    r."id",
    p."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "roles" AS r
CROSS JOIN "permissions" AS p
WHERE r."name" IN ('super', 'admin', 'chef')
  AND p."name" IN ('menu.read', 'menu.manage')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
