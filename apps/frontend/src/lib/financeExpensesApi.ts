import { apiFetch } from "@/utils/apiFetch";

export type FinanceExpenseKind = "FIXED" | "VARIABLE";
export type FinanceExpensePeriodicity = "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "ANNUAL";

export type FinanceExpenseItem = {
  id: number;
  kind: FinanceExpenseKind;
  month: string;
  concept: string;
  periodicity: FinanceExpensePeriodicity | null;
  base: string | null;
  amount: number;
  active: boolean;
};

export type FinanceExpensesResponse = {
  month: string;
  fixed: FinanceExpenseItem[];
  variable: FinanceExpenseItem[];
  totals: {
    fixed: number;
    variable: number;
  };
};

export type FinanceExpensePayload = {
  kind: FinanceExpenseKind;
  month: string;
  concept: string;
  amount: number;
  active?: boolean;
  periodicity?: FinanceExpensePeriodicity | null;
  base?: string | null;
};

export function fetchFinanceExpenses(month: string) {
  return apiFetch<FinanceExpensesResponse>(`/finance/expenses?month=${encodeURIComponent(month)}`);
}

export function createFinanceExpense(payload: FinanceExpensePayload) {
  return apiFetch<FinanceExpenseItem>("/finance/expenses", {
    method: "POST",
    json: payload,
  });
}

export function updateFinanceExpense(id: number, payload: Partial<FinanceExpensePayload>) {
  return apiFetch<FinanceExpenseItem>(`/finance/expenses/${id}`, {
    method: "PUT",
    json: payload,
  });
}

export function deleteFinanceExpense(id: number) {
  return apiFetch<void>(`/finance/expenses/${id}`, {
    method: "DELETE",
  });
}
