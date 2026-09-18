export type SalesAnalyticsPeriod = 'day' | 'week' | 'month' | 'year' | 'custom';

export type SalesAnalyticsRow = {
  menuItemId: number;
  name: string;
  quantity: number;
  salesAmount: string;
  consumptionTaxAmount: string;
  grossAmount: string;
  consumptionSubtotal: string;
};

export type SalesAnalyticsSummary = {
  salesAmount: string;
  consumptionTaxAmount: string;
  serviceAmount: string;
  totalCollected: string;
  closedOrders: number;
  unitsSold: number;
};

export type SalesAnalyticsCurrency = {
  currency: string;
  summary: SalesAnalyticsSummary;
  products: SalesAnalyticsRow[];
  additions: SalesAnalyticsRow[];
  categories: Array<SalesAnalyticsRow & { categoryId: number | null; categoryName: string }>;
  details: Array<{
    settledAt: string;
    orderId: number;
    table: string;
    items: Array<{ name: string; quantity: number; isAddition: boolean }>;
    salesAmount: string;
    consumptionTaxAmount: string;
    serviceAmount: string;
    totalCollected: string;
    currency: string;
  }>;
};

export type SalesAnalyticsResponse = {
  period: { preset: SalesAnalyticsPeriod; from: string; to: string; date?: string; week?: string; month?: string; year?: string };
  currencies: SalesAnalyticsCurrency[];
  yearToDate: { from: string; to: string; currencies: SalesAnalyticsCurrency[] };
  filterOptions: {
    products: Array<{ menuItemId: number; name: string }>;
    categories: Array<{ categoryId: number; name: string }>;
    years: number[];
  };
};
