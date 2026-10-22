-- CreateEnum
CREATE TYPE "FinancePaymentMethodKind" AS ENUM ('CASH', 'BANK', 'GATEWAY', 'OTHER');

-- CreateEnum
CREATE TYPE "FinanceCounterpartyKind" AS ENUM ('SUPPLIER', 'CUSTOMER', 'EMPLOYEE', 'OTHER');

-- CreateEnum
CREATE TYPE "FinanceMovementKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "FinanceMovementStatus" AS ENUM ('POSTED', 'PENDING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinancePayableStatus" AS ENUM ('OPEN', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "finance_payment_methods" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FinancePaymentMethodKind" NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'COP',
    "currentBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_counterparties" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FinanceCounterpartyKind" NOT NULL,
    "taxId" VARCHAR(50),
    "email" VARCHAR(320),
    "phone" VARCHAR(50),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_counterparties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_manual_movements" (
    "id" SERIAL NOT NULL,
    "kind" "FinanceMovementKind" NOT NULL,
    "status" "FinanceMovementStatus" NOT NULL DEFAULT 'POSTED',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "concept" VARCHAR(300) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'COP',
    "documentNumber" VARCHAR(120),
    "counterpartyId" INTEGER,
    "paymentMethodId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "cancelledById" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_manual_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_transfers" (
    "id" SERIAL NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "sourceMethodId" INTEGER NOT NULL,
    "targetMethodId" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'COP',
    "description" VARCHAR(300) NOT NULL,
    "documentNumber" VARCHAR(120),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_payables" (
    "id" SERIAL NOT NULL,
    "concept" VARCHAR(300) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'COP',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "FinancePayableStatus" NOT NULL DEFAULT 'OPEN',
    "counterpartyId" INTEGER NOT NULL,
    "paymentMethodId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidMovementId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_payables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finance_payment_methods_name_key" ON "finance_payment_methods"("name");

-- CreateIndex
CREATE INDEX "finance_counterparties_kind_active_idx" ON "finance_counterparties"("kind", "active");

-- CreateIndex
CREATE INDEX "finance_manual_movements_kind_occurredAt_idx" ON "finance_manual_movements"("kind", "occurredAt");

-- CreateIndex
CREATE INDEX "finance_manual_movements_paymentMethodId_occurredAt_idx" ON "finance_manual_movements"("paymentMethodId", "occurredAt");

-- CreateIndex
CREATE INDEX "finance_manual_movements_counterpartyId_idx" ON "finance_manual_movements"("counterpartyId");

-- CreateIndex
CREATE INDEX "finance_manual_movements_status_occurredAt_idx" ON "finance_manual_movements"("status", "occurredAt");

-- CreateIndex
CREATE INDEX "finance_transfers_occurredAt_idx" ON "finance_transfers"("occurredAt");

-- CreateIndex
CREATE INDEX "finance_transfers_sourceMethodId_occurredAt_idx" ON "finance_transfers"("sourceMethodId", "occurredAt");

-- CreateIndex
CREATE INDEX "finance_transfers_targetMethodId_occurredAt_idx" ON "finance_transfers"("targetMethodId", "occurredAt");

-- CreateIndex
CREATE INDEX "finance_payables_status_dueDate_idx" ON "finance_payables"("status", "dueDate");

-- CreateIndex
CREATE INDEX "finance_payables_counterpartyId_idx" ON "finance_payables"("counterpartyId");

-- RenameForeignKey
ALTER TABLE "kitchen_dispatch_items" RENAME CONSTRAINT "kitchen_dispatch_items_parentDispatchItemId_fkey" TO "kitchen_dispatch_items_parentDispatchItemId_kitchenDispatc_fkey";

-- AddForeignKey
ALTER TABLE "finance_manual_movements" ADD CONSTRAINT "finance_manual_movements_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "finance_counterparties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_manual_movements" ADD CONSTRAINT "finance_manual_movements_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "finance_payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_manual_movements" ADD CONSTRAINT "finance_manual_movements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_manual_movements" ADD CONSTRAINT "finance_manual_movements_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transfers" ADD CONSTRAINT "finance_transfers_sourceMethodId_fkey" FOREIGN KEY ("sourceMethodId") REFERENCES "finance_payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transfers" ADD CONSTRAINT "finance_transfers_targetMethodId_fkey" FOREIGN KEY ("targetMethodId") REFERENCES "finance_payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_transfers" ADD CONSTRAINT "finance_transfers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_payables" ADD CONSTRAINT "finance_payables_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "finance_counterparties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_payables" ADD CONSTRAINT "finance_payables_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "finance_payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_payables" ADD CONSTRAINT "finance_payables_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "kitchen_inventory_consumption_items_consumptionId_kitchenDispat" RENAME TO "kitchen_inventory_consumption_items_consumptionId_kitchenDi_key";
