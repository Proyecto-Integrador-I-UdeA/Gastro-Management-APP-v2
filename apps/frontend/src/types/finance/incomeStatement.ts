export type IncomeStatementGranularity = 'month' | 'year';
export type CashMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';

export type IncomeStatementSummaryQuery = {
  from: string;
  to: string;
  granularity: IncomeStatementGranularity;
};

export type IncomeStatementPnl = {
  revenue: {
    sales: string;
    service: string;
    total: string;
    consumptionTax: string;
  };
  cogs: {
    real: string;
    theoretical: string;
    variance: string;
  };
  grossProfit: string;
  operatingExpenses: {
    fixed: string;
    variable: string;
    payroll: string;
    total: string;
    hasData: boolean;
  };
  operatingProfit: string;
  netProfit: string;
};

export type IncomeStatementKpis = {
  margins: {
    grossMarginPct: string;
    operatingMarginPct: string;
    netMarginPct: string;
    foodCostPct: string;
    primeCostPct: string;
    wastePct: string;
  };
  costStructure: {
    laborCostPct: string;
    rentCostPct: string;
    variableCostPct: string;
    totalCostPct: string;
  };
  breakEven: {
    revenue: string;
    orders: string;
    marginOfSafetyPct: string;
    feasible: boolean;
  };
  volume: {
    orderCount: number;
    avgTicket: string;
    totalGuests: number;
    avgGuestsPerOrder: string;
    revenuePerGuest: string;
    unitsSold: number;
    hasGuestData: boolean;
  };
  operations: {
    tableTurnover: string;
    avgKitchenTimeMinutes: number | null;
    hasDispatchData: boolean;
    reservationCompletionRatePct: string | null;
    totalReservations: number;
  };
  cash: {
    totalCollected: string;
    byMethod: Record<CashMethod, string>;
    cashRatioPct: string;
    cashReconciliationDifference: string | null;
    hasClosedSessions: boolean;
  };
};

export type IncomeStatementBucket = {
  period: string;
  revenue: string;
  grossProfit: string;
  operatingProfit: string;
  netProfit: string;
};

export type IncomeStatementCurrencySummary = {
  currency: string;
  pnl: IncomeStatementPnl;
  kpis: IncomeStatementKpis;
  buckets: IncomeStatementBucket[];
};

export type IncomeStatementSummaryResponse = {
  period: {
    from: string;
    to: string;
    granularity: IncomeStatementGranularity;
  };
  currencies: IncomeStatementCurrencySummary[];
};