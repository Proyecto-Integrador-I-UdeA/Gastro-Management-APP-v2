export type PaymentMethodKind = 'CASH' | 'BANK' | 'GATEWAY' | 'OTHER';

export type FinanceDashboardQuery = {
  from: string;
  to: string;
};

export type FinanceDashboardResponse = {
  period: { from: string; to: string };
  currency: string;
  hasIncomeData: boolean;
  multiCurrencyDetected: boolean;
  liquidity: {
    availableBalance: string;
    next7DaysPayables: string;
    coverageRatio: string | null;
    hasPayables: boolean;
    payablesCount: number;
    paymentMethods: Array<{
      id: number;
      name: string;
      kind: PaymentMethodKind;
      currentBalance: string;
    }>;
  };
  efficiency: {
    avgTicket: string;
    foodCostPct: string;
    fixedCostRatioPct: string;
  };
  profitability: {
    revenue: string;
    grossProfit: string;
    grossMarginPct: string;
    operatingProfit: string;
    operatingMarginPct: string;
    netProfit: string;
    netMarginPct: string;
  };
};