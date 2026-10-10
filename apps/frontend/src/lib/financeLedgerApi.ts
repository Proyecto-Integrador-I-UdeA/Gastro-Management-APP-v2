import { apiFetch } from "@/utils/apiFetch";

export type FinanceLedgerSide = "PAYABLE" | "RECEIVABLE";
export type FinanceLedgerStatus = "PAID" | "OVERDUE" | "UPCOMING" | "PENDING";

export type FinanceLedgerDocument = {
  id: number;
  side: FinanceLedgerSide;
  supplierId: number | null;
  partyName: string | null;
  documentNumber: string;
  invoiceNumber: string | null;
  issuedAt: string;
  dueAt: string;
  amount: number;
  paidAmount: number;
  balance: number;
  status: FinanceLedgerStatus;
};

export type FinanceLedgerSupplierOption = {
  id: number;
  name: string;
};

export type FinanceLedgerResponse = {
  month: string;
  payables: FinanceLedgerDocument[];
  receivables: FinanceLedgerDocument[];
  suppliers: FinanceLedgerSupplierOption[];
};

export type FinanceLedgerPayload = {
  side: FinanceLedgerSide;
  supplierId?: number | null;
  partyName?: string | null;
  invoiceNumber?: string | null;
  issuedAt: string;
  dueAt: string;
  amount: number;
};

export function fetchFinanceLedger(month: string) {
  return apiFetch<FinanceLedgerResponse>(`/finance/ledger?month=${encodeURIComponent(month)}`);
}

export function createFinanceLedger(payload: FinanceLedgerPayload) {
  return apiFetch<FinanceLedgerDocument>("/finance/ledger", {
    method: "POST",
    json: payload,
  });
}

export function updateFinanceLedger(id: number, payload: Partial<FinanceLedgerPayload>) {
  return apiFetch<FinanceLedgerDocument>(`/finance/ledger/${id}`, {
    method: "PUT",
    json: payload,
  });
}

export function deleteFinanceLedger(id: number) {
  return apiFetch<void>(`/finance/ledger/${id}`, { method: "DELETE" });
}

export function createFinanceLedgerPayment(id: number, amount: number) {
  return apiFetch<FinanceLedgerDocument>(`/finance/ledger/${id}/payments`, {
    method: "POST",
    json: { amount },
  });
}
