export type IncomeRecognition = 'accrual' | 'cash';
export type IncomeGranularity = 'day' | 'week' | 'month' | 'year';
export type CashPaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';

export type IncomeSummaryQuery = {
  from: string;
  to: string;
  recognition: IncomeRecognition;
  granularity: IncomeGranularity;
  includeService: boolean;
};

export type IncomeTotals = {
  salesAmount: string;
  consumptionTaxAmount: string;
  serviceAmount: string;
  totalCollected: string;
  orderCount: number;
  avgTicket: string;
  operationalIncome: string;
};

export type IncomeBucket = {
  period: string;
  salesAmount: string;
  orderCount: number;
};

export type IncomeCurrencySummary = {
  currency: string;
  totals: IncomeTotals;
  buckets: IncomeBucket[];
  byPaymentMethod?: Record<CashPaymentMethod, string>;
};

export type IncomeSummaryResponse = {
  period: {
    from: string;
    to: string;
    recognition: IncomeRecognition;
    granularity: IncomeGranularity;
    includeService: boolean;
  };
  currencies: IncomeCurrencySummary[];
};