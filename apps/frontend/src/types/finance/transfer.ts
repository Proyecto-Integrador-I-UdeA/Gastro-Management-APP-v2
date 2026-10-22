export type PaymentMethodKind = 'CASH' | 'BANK' | 'GATEWAY' | 'OTHER';

export type PaymentMethodRef = {
  id: number;
  name: string;
  kind: PaymentMethodKind;
  currency: string;
  currentBalance: string;
};

export type Transfer = {
  id: number;
  occurredAt: string;
  amount: string;
  currency: string;
  description: string;
  documentNumber: string | null;
  sourceMethod: PaymentMethodRef | null;
  targetMethod: PaymentMethodRef | null;
  createdById: number;
  createdAt: string;
  updatedAt: string;
};

export type TransferReferences = {
  paymentMethods: PaymentMethodRef[];
};

export type CreateTransferInput = {
  occurredAt: string;
  sourceMethodId: number;
  targetMethodId: number;
  amount: string;
  description: string;
  documentNumber?: string | null;
};

export type ListTransfersQuery = {
  from?: string;
  to?: string;
  sourceMethodId?: number;
  targetMethodId?: number;
  search?: string;
};