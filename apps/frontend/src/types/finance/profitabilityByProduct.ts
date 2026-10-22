export type ProfitabilityByProductQuery = {
  from: string;
  to: string;
  categoryId?: number;
  search?: string;
};

export type ProductProfitability = {
  menuItemId: number;
  menuItemName: string;
  categoryId: number | null;
  categoryName: string | null;
  unitsSold: number;
  orderCount: number;
  revenue: string;
  cogsTheoretical: string;
  grossProfit: string;
  grossMarginPct: string;
  foodCostPct: string;
  isBelowTarget: boolean;
};

export type CategoryProfitability = {
  categoryId: number | null;
  categoryName: string;
  unitsSold: number;
  productCount: number;
  revenue: string;
  cogsTheoretical: string;
  grossProfit: string;
  grossMarginPct: string;
  foodCostPct: string;
  productsBelowTarget: number;
};

export type ProfitabilityByProductResponse = {
  period: { from: string; to: string };
  targets: {
    foodCostTargetPct: string;
    productMarginTargetPct: string;
  };
  totals: {
    currency: string;
    revenue: string;
    cogsTheoretical: string;
    grossProfit: string;
    grossMarginPct: string;
    foodCostPct: string;
    totalOrders: number;
    profitableOrders: number;
    profitableOrdersPct: string;
    totalProducts: number;
    productsBelowTarget: number;
    productsBelowTargetPct: string;
    totalUnitsSold: number;
  };
  categories: CategoryProfitability[];
  products: ProductProfitability[];
};