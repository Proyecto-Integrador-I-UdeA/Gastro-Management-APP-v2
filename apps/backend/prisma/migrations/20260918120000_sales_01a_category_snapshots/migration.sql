-- SALES-01A: preserve the menu category attached to a sold order line.
-- Existing rows are backfilled from the current MenuItem relationship. This
-- is necessarily approximate because older sales did not store category data.
ALTER TABLE "sales_order_items"
  ADD COLUMN "menuCategoryIdSnapshot" INTEGER,
  ADD COLUMN "menuCategoryNameSnapshot" TEXT;

UPDATE "sales_order_items" AS soi
SET
  "menuCategoryIdSnapshot" = mi."categoryId",
  "menuCategoryNameSnapshot" = mc."name"
FROM "MenuItem" AS mi
LEFT JOIN "menu_categories" AS mc ON mc."id" = mi."categoryId"
WHERE mi."id" = soi."menuItemId";

CREATE INDEX "sales_order_items_menuCategoryIdSnapshot_idx"
  ON "sales_order_items"("menuCategoryIdSnapshot");
