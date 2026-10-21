-- CreateEnum
CREATE TYPE "FinanceLedgerSide" AS ENUM ('PAYABLE', 'RECEIVABLE');

-- CreateTable
CREATE TABLE "finance_ledger_documents" (
    "id" SERIAL NOT NULL,
    "side" "FinanceLedgerSide" NOT NULL,
    "supplierId" INTEGER,
    "partyName" TEXT,
    "documentNumber" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_ledger_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_ledger_payments" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_ledger_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finance_ledger_documents_side_documentNumber_key" ON "finance_ledger_documents"("side", "documentNumber");

-- CreateIndex
CREATE INDEX "finance_ledger_documents_side_dueAt_idx" ON "finance_ledger_documents"("side", "dueAt");

-- CreateIndex
CREATE INDEX "finance_ledger_payments_documentId_paidAt_idx" ON "finance_ledger_payments"("documentId", "paidAt");

-- AddForeignKey
ALTER TABLE "finance_ledger_documents"
ADD CONSTRAINT "finance_ledger_documents_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_ledger_payments"
ADD CONSTRAINT "finance_ledger_payments_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "finance_ledger_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
