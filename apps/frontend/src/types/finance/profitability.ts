export type ProfitabilityGranularity = 'month' | 'year';

export type ProfitabilitySummaryQuery = {
  from: string;
  to: string;
  granularity: ProfitabilityGranularity;
};

export type ProfitabilityTotals = {
  revenue: string;
  cogsTheoretical: string;
  cogsReal: string;
  cogsVariance: string;
  grossProfit: string;
  grossMarginPct: string;
  operatingExpenses: {
    fixedCosts: string;
    variableCosts: string;
    payroll: string;
    total: string;
    hasData: boolean;
  };
  operatingProfit: string;
  operatingMarginPct: string;
  foodCostPct: string;
  wastePct: string;
};

export type ProfitabilityBucket = {
  period: string;
  revenue: string;
  cogsReal: string;
  grossProfit: string;
  operatingExpenses: string;
  operatingProfit: string;
};

export type ProfitabilityCurrencySummary = {
  currency: string;
  totals: ProfitabilityTotals;
  buckets: ProfitabilityBucket[];
};

export type ProfitabilitySummaryResponse = {
  period: {
    from: string;
    to: string;
    granularity: ProfitabilityGranularity;
  };
  currencies: ProfitabilityCurrencySummary[];
};