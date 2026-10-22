export type MovementKind = 'INCOME' | 'EXPENSE';
export type MovementStatus = 'POSTED' | 'PENDING' | 'CANCELLED';
export type PaymentMethodKind = 'CASH' | 'BANK' | 'GATEWAY' | 'OTHER';
export type CounterpartyKind = 'SUPPLIER' | 'CUSTOMER' | 'EMPLOYEE' | 'OTHER';

export type CounterpartyRef = {
  id: number;
  name: string;
  kind: CounterpartyKind;
  taxId?: string | null;
};

export type PaymentMethodRef = {
  id: number;
  name: string;
  kind: PaymentMethodKind;
  currency: string;
  currentBalance: string;
};

export type ManualMovement = {
  id: number;
  kind: MovementKind;
  status: MovementStatus;
  occurredAt: string;
  concept: string;
  amount: string;
  currency: string;
  documentNumber: string | null;
  counterparty: { id: number; name: string; kind: CounterpartyKind } | null;
  paymentMethod: { id: number; name: string; kind: PaymentMethodKind } | null;
  createdById: number;
  cancelledById: number | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ManualMovementSummary = {
  date: string;
  day: { income: string; expense: string; net: string; pendingCount: number };
  month: { from: string; to: string; income: string; expense: string; net: string; pendingCount: number };
  byPaymentMethod: Array<{
    id: number;
    name: string;
    kind: PaymentMethodKind;
    currency: string;
    currentBalance: string;
    dayIncome: string;
    dayExpense: string;
    dayNet: string;
    monthIncome: string;
    monthExpense: string;
    monthNet: string;
  }>;
};

export type ManualMovementReferences = {
  counterparties: CounterpartyRef[];
  paymentMethods: PaymentMethodRef[];
};

export type CreateManualMovementInput = {
  kind: MovementKind;
  occurredAt: string;
  concept: string;
  amount: string;
  currency?: string;
  documentNumber?: string | null;
  counterpartyId?: number | null;
  paymentMethodId: number;
};

export type ListManualMovementsQuery = {
  from?: string;
  to?: string;
  kind?: MovementKind;
  status?: MovementStatus;
  paymentMethodId?: number;
  search?: string;
};

// POS sales (ventas del día) — se componen con income/summary en el frontend
export type PosSalesOfDay = {
  cashSalesAmount: string;
  totalCollected: string;
  orderCount: number;
};