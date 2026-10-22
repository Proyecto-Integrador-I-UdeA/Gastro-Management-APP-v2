import { apiFetch } from "@/utils/apiFetch";

export type FinancePayrollArea = "KITCHEN" | "SERVICE" | "ADMIN" | "SUPPORT";
export type FinancePayrollPeriodStatus = "OPEN" | "CLOSED";

export type FinanceEmployee = {
  id: number;
  fullName: string;
  nationalId: string;
  area: FinancePayrollArea;
  position: string;
  hiredAt: string;
  monthlySalary: number;
  active: boolean;
};

export type FinancePayrollEntry = {
  id: number;
  periodId: number;
  employeeId: number;
  fullName: string;
  nationalId: string;
  area: FinancePayrollArea;
  position: string;
  salary: number;
  extras: number;
  deductions: number;
  benefits: number;
  note: string | null;
  gross: number;
  net: number;
  employerCost: number;
};

export type FinancePayrollAreaSummary = {
  area: FinancePayrollArea;
  employeeCount: number;
  salaries: number;
  extras: number;
  benefits: number;
  total: number;
};

export type FinancePayrollPeriod = {
  id: number;
  month: string;
  status: FinancePayrollPeriodStatus;
  note: string | null;
  closedAt: string | null;
  entries: FinancePayrollEntry[];
  byArea: FinancePayrollAreaSummary[];
  totals: {
    employeeCount: number;
    salaries: number;
    extras: number;
    deductions: number;
    benefits: number;
    net: number;
    employerCost: number;
  };
};

export type FinancePayrollResponse = {
  month: string;
  employees: FinanceEmployee[];
  period: FinancePayrollPeriod | null;
};

export type FinanceEmployeePayload = {
  fullName: string;
  nationalId: string;
  area: FinancePayrollArea;
  position: string;
  hiredAt: string;
  monthlySalary: number;
  active?: boolean;
};

export type FinancePayrollEntryPayload = {
  salary?: number;
  extras?: number;
  deductions?: number;
  benefits?: number;
  note?: string | null;
};

export function fetchFinancePayroll(month: string) {
  return apiFetch<FinancePayrollResponse>(`/finance/payroll?month=${encodeURIComponent(month)}`);
}

export function createFinanceEmployee(payload: FinanceEmployeePayload) {
  return apiFetch<FinanceEmployee>("/finance/employees", {
    method: "POST",
    json: payload,
  });
}

export function updateFinanceEmployee(id: number, payload: Partial<FinanceEmployeePayload>) {
  return apiFetch<FinanceEmployee>(`/finance/employees/${id}`, {
    method: "PUT",
    json: payload,
  });
}

export function deleteFinanceEmployee(id: number) {
  return apiFetch<void>(`/finance/employees/${id}`, { method: "DELETE" });
}

export function generateFinancePayroll(month: string) {
  return apiFetch<FinancePayrollResponse>("/finance/payroll/generate", {
    method: "POST",
    json: { month },
  });
}

export function updateFinancePayrollEntry(id: number, payload: FinancePayrollEntryPayload) {
  return apiFetch<FinancePayrollEntry>(`/finance/payroll/entries/${id}`, {
    method: "PUT",
    json: payload,
  });
}

export function deleteFinancePayrollEntry(id: number) {
  return apiFetch<void>(`/finance/payroll/entries/${id}`, { method: "DELETE" });
}

export function closeFinancePayroll(id: number) {
  return apiFetch<FinancePayrollResponse>(`/finance/payroll/${id}/close`, { method: "POST" });
}

export function reopenFinancePayroll(id: number) {
  return apiFetch<FinancePayrollResponse>(`/finance/payroll/${id}/reopen`, { method: "POST" });
}
