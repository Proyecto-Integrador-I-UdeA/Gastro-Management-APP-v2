-- AlterTable
ALTER TABLE "finance_ledger_documents" ADD COLUMN "invoiceNumber" TEXT;

-- Receivables keep the internal consecutive as their invoice code.
UPDATE "finance_ledger_documents"
SET "invoiceNumber" = "documentNumber"
WHERE "side" = 'RECEIVABLE';

-- Payables that were stored with a supplier invoice (not FC-#####) keep that as the external code.
UPDATE "finance_ledger_documents"
SET "invoiceNumber" = "documentNumber"
WHERE "side" = 'PAYABLE'
  AND "documentNumber" !~ '^FC-[0-9]+$';
