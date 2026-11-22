ALTER TABLE "finance_payroll_entries"
ADD COLUMN "restDayDayHours" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "restDayNightHours" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "finance_payroll_entries"
ADD CONSTRAINT "finance_payroll_entries_rest_day_hours_nonnegative_check"
CHECK (
  "restDayDayHours" >= 0
  AND "restDayNightHours" >= 0
);
