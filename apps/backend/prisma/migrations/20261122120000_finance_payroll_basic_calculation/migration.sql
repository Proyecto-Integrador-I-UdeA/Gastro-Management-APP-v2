-- FINANCE payroll MVP: additive Colombian basic calculation fields.
ALTER TABLE "finance_employees"
ADD COLUMN "transportAidEligible" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "finance_payroll_entries"
ADD COLUMN "dayOvertimeHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "nightOvertimeHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "nightSurchargeHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "transportAid" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "healthDeduction" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "pensionDeduction" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "otherDeductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN "calculationVersion" TEXT;

ALTER TABLE "finance_payroll_entries"
ADD CONSTRAINT "finance_payroll_entries_hours_nonnegative_check"
CHECK (
  "dayOvertimeHours" >= 0
  AND "nightOvertimeHours" >= 0
  AND "nightSurchargeHours" >= 0
),
ADD CONSTRAINT "finance_payroll_entries_basic_amounts_nonnegative_check"
CHECK (
  "transportAid" >= 0
  AND "healthDeduction" >= 0
  AND "pensionDeduction" >= 0
  AND "otherDeductions" >= 0
);

-- Existing rows intentionally keep calculationVersion NULL and remain legacy.
