-- CreateEnum
CREATE TYPE "FinanceExpenseKind" AS ENUM ('FIXED', 'VARIABLE');

-- CreateEnum
CREATE TYPE "FinanceExpensePeriodicity" AS ENUM ('MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateTable
CREATE TABLE "finance_expense_items" (
    "id" SERIAL NOT NULL,
    "kind" "FinanceExpenseKind" NOT NULL,
    "month" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "periodicity" "FinanceExpensePeriodicity",
    "base" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_expense_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finance_expense_items_kind_month_idx" ON "finance_expense_items"("kind", "month");

-- CreateIndex
CREATE UNIQUE INDEX "finance_expense_items_kind_month_concept_key" ON "finance_expense_items"("kind", "month", "concept");

-- El rol accounting ya existía, pero no tenía los permisos de su propio módulo.
INSERT INTO "role_permissions" ("roleId", "permissionId", "createdAt", "updatedAt")
SELECT
    r."id",
    p."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "roles" AS r
CROSS JOIN "permissions" AS p
WHERE r."name" = 'accounting'
  AND p."name" IN ('accounting.read', 'accounting.update')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
