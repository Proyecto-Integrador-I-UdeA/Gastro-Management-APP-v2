CREATE TYPE "FinanceArlRiskClass" AS ENUM ('I', 'II', 'III', 'IV', 'V');

ALTER TABLE "finance_employees"
ADD COLUMN "employerHealthContributionApplies" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "arlRiskClass" "FinanceArlRiskClass" NOT NULL DEFAULT 'I';

ALTER TABLE "finance_payroll_entries"
ADD COLUMN "employerHealthContributionApplies" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "arlRiskClass" "FinanceArlRiskClass" NOT NULL DEFAULT 'I';
