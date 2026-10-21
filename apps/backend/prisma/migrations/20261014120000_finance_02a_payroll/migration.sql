-- CreateEnum
CREATE TYPE "FinancePayrollArea" AS ENUM ('KITCHEN', 'SERVICE', 'ADMIN', 'SUPPORT');

-- CreateEnum
CREATE TYPE "FinancePayrollPeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "finance_employees" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "area" "FinancePayrollArea" NOT NULL,
    "position" TEXT NOT NULL,
    "hiredAt" TIMESTAMP(3) NOT NULL,
    "monthlySalary" DECIMAL(14,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_payroll_periods" (
    "id" SERIAL NOT NULL,
    "month" TEXT NOT NULL,
    "status" "FinancePayrollPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_payroll_entries" (
    "id" SERIAL NOT NULL,
    "periodId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "area" "FinancePayrollArea" NOT NULL,
    "position" TEXT NOT NULL,
    "salary" DECIMAL(14,2) NOT NULL,
    "extras" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "benefits" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_payroll_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finance_employees_nationalId_key" ON "finance_employees"("nationalId");

-- CreateIndex
CREATE INDEX "finance_employees_active_area_idx" ON "finance_employees"("active", "area");

-- CreateIndex
CREATE UNIQUE INDEX "finance_payroll_periods_month_key" ON "finance_payroll_periods"("month");

-- CreateIndex
CREATE UNIQUE INDEX "finance_payroll_entries_periodId_employeeId_key" ON "finance_payroll_entries"("periodId", "employeeId");

-- CreateIndex
CREATE INDEX "finance_payroll_entries_periodId_area_idx" ON "finance_payroll_entries"("periodId", "area");

-- AddForeignKey
ALTER TABLE "finance_payroll_entries"
ADD CONSTRAINT "finance_payroll_entries_periodId_fkey"
FOREIGN KEY ("periodId") REFERENCES "finance_payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_payroll_entries"
ADD CONSTRAINT "finance_payroll_entries_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "finance_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
