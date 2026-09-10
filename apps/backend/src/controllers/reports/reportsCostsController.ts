import { Request, Response } from 'express';
import prisma from '../../lib/prisma';

const DEFAULT_MARGIN = 0.4;
const DEFAULT_TAX = 0.22;

type ProductCostSource = {
  unitCost: number | null;
  inputUnitQuantity: number | null;
} | null;

function productLineCost(quantity: number, product: ProductCostSource): number {
  if (!product) return 0;
  const unitCost = Number(product.unitCost ?? 0);
  const baseQty = Number(product.inputUnitQuantity ?? 1) || 1;
  return (quantity / baseQty) * unitCost;
}

function recipeIngredientsCost(
  items: Array<{ quantity: number; product: ProductCostSource }>
): number {
  return items.reduce(
    (sum, item) => sum + productLineCost(Number(item.quantity ?? 0), item.product),
    0
  );
}

function recipeCostPerPortion(
  recipe: { portions: number; items: Array<{ quantity: number; product: ProductCostSource }> }
): number {
  const total = recipeIngredientsCost(recipe.items);
  const portions = Number(recipe.portions ?? 1) || 1;
  return total / portions;
}

function menuItemBaseCost(
  components: Array<{
    quantity: number;
    product: ProductCostSource;
    recipe: {
      portions: number;
      items: Array<{ quantity: number; product: ProductCostSource }>;
    } | null;
  }>
): number {
  return components.reduce((sum, comp) => {
    const quantity = Number(comp.quantity ?? 0);
    if (comp.product) {
      return sum + productLineCost(quantity, comp.product);
    }
    if (comp.recipe) {
      return sum + recipeCostPerPortion(comp.recipe) * quantity;
    }
    return sum;
  }, 0);
}

function suggestedPriceFromCost(
  totalCost: number,
  margin = DEFAULT_MARGIN,
  tax = DEFAULT_TAX
): { suggestedPrice: number; utility: number; foodCostPct: number } {
  if (totalCost <= 0) {
    return { suggestedPrice: 0, utility: 0, foodCostPct: 0 };
  }
  const priceWithoutTax = totalCost / (1 - margin);
  const finalPrice = priceWithoutTax * (1 + tax);
  const suggestedPrice = Math.ceil(finalPrice / 1000) * 1000;
  const utility = priceWithoutTax - totalCost;
  const foodCostPct = suggestedPrice > 0 ? (totalCost / suggestedPrice) * 100 : 0;
  return { suggestedPrice, utility, foodCostPct };
}

function overheadStatus(perPlate: number): 'healthy' | 'review' | 'high' | 'none' {
  if (perPlate <= 0) return 'none';
  if (perPlate > 5000) return 'high';
  if (perPlate >= 2000) return 'review';
  return 'healthy';
}

export interface CostsOperationalRow {
  id: number;
  month: string;
  fixedCosts: number;
  variableCosts: number;
  payroll: number;
  monthlyProduction: number | null;
  totalMonthly: number;
  costPerUnit: number | null;
  createdAt: string;
}

export interface CostsMenuRow {
  menuItemId: number;
  name: string;
  active: boolean;
  baseCost: number;
  indirectCost: number;
  totalCost: number;
  indirectSharePct: number;
  suggestedPrice: number;
  estimatedUtility: number;
  foodCostPct: number;
}

export interface CostsRecipeRow {
  recipeId: number;
  internalCode: string;
  name: string;
  active: boolean;
  portions: number;
  ingredientsCost: number;
  costPerPortion: number;
}

/**
 * Resumen de costos operativos, food cost por plato y costo de recetas.
 * Pensado para reportes (permiso `reports.read`).
 */
export const getCostsReport = async (_req: Request, res: Response) => {
  try {
    const [operationalConfigs, menuItems, recipes] = await Promise.all([
      prisma.operationalCostConfig.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      prisma.menuItem.findMany({
        orderBy: { name: 'asc' },
        include: {
          components: {
            include: {
              product: {
                select: { unitCost: true, inputUnitQuantity: true },
              },
              recipe: {
                include: {
                  items: {
                    include: {
                      product: {
                        select: { unitCost: true, inputUnitQuantity: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.recipe.findMany({
        orderBy: { internalCode: 'asc' },
        include: {
          items: {
            include: {
              product: {
                select: { unitCost: true, inputUnitQuantity: true },
              },
            },
          },
        },
      }),
    ]);

    const operationalRows: CostsOperationalRow[] = operationalConfigs.map((c) => {
      const fixedCosts = Number(c.fixedCosts ?? 0);
      const variableCosts = Number(c.variableCosts ?? 0);
      const payroll = Number(c.payroll ?? 0);
      const totalMonthly = fixedCosts + variableCosts + payroll;
      const production = Number(c.monthlyProduction ?? 0);
      const costPerUnit = production > 0 ? totalMonthly / production : null;

      return {
        id: c.id,
        month: c.month,
        fixedCosts,
        variableCosts,
        payroll,
        monthlyProduction: c.monthlyProduction,
        totalMonthly,
        costPerUnit,
        createdAt: c.createdAt.toISOString(),
      };
    });

    const latestOperational = operationalRows[0] ?? null;
    const indirectCostPerUnit = latestOperational?.costPerUnit ?? 0;

    const menuRows: CostsMenuRow[] = menuItems.map((m) => {
      const baseCost = menuItemBaseCost(m.components);
      const indirectCost = indirectCostPerUnit;
      const totalCost = baseCost + indirectCost;
      const indirectSharePct =
        totalCost > 0 ? (indirectCost / totalCost) * 100 : 0;
      const pricing = suggestedPriceFromCost(totalCost);

      return {
        menuItemId: m.id,
        name: m.name,
        active: m.active,
        baseCost,
        indirectCost,
        totalCost,
        indirectSharePct,
        suggestedPrice: pricing.suggestedPrice,
        estimatedUtility: pricing.utility,
        foodCostPct: pricing.foodCostPct,
      };
    });

    const recipeRows: CostsRecipeRow[] = recipes.map((r) => {
      const ingredientsCost = recipeIngredientsCost(r.items);
      const portions = Number(r.portions ?? 1) || 1;
      const costPerPortion = ingredientsCost / portions;

      return {
        recipeId: r.id,
        internalCode: r.internalCode,
        name: r.name,
        active: r.active,
        portions: r.portions,
        ingredientsCost,
        costPerPortion,
      };
    });

    const activeMenu = menuRows.filter((m) => m.active);
    const activeRecipes = recipeRows.filter((r) => r.active);

    const menuTotals = activeMenu.map((m) => m.totalCost).filter((c) => c > 0);
    const menuBases = activeMenu.map((m) => m.baseCost).filter((c) => c > 0);
    const recipePortions = activeRecipes
      .map((r) => r.costPerPortion)
      .filter((c) => c > 0);

    const kpis = {
      hasOperationalConfig: latestOperational != null,
      configMonth: latestOperational?.month ?? null,
      totalMonthlyOperational: latestOperational?.totalMonthly ?? null,
      indirectCostPerUnit: latestOperational?.costPerUnit ?? null,
      monthlyProduction: latestOperational?.monthlyProduction ?? null,
      overheadStatus: overheadStatus(latestOperational?.costPerUnit ?? 0),
      configCount: operationalRows.length,
      activeMenuItems: activeMenu.length,
      activeRecipes: activeRecipes.length,
      avgMenuTotalCost:
        menuTotals.length > 0
          ? menuTotals.reduce((a, b) => a + b, 0) / menuTotals.length
          : null,
      avgMenuBaseCost:
        menuBases.length > 0
          ? menuBases.reduce((a, b) => a + b, 0) / menuBases.length
          : null,
      avgRecipeCostPerPortion:
        recipePortions.length > 0
          ? recipePortions.reduce((a, b) => a + b, 0) / recipePortions.length
          : null,
      menuItemsWithZeroCost: activeMenu.filter((m) => m.totalCost <= 0).length,
      highFoodCostItems: activeMenu.filter((m) => m.foodCostPct >= 40).length,
    };

    const operationalBreakdown = latestOperational
      ? [
          { name: 'Costos fijos', value: latestOperational.fixedCosts },
          { name: 'Costos variables', value: latestOperational.variableCosts },
          { name: 'Nómina', value: latestOperational.payroll },
        ]
      : [];

    const topExpensiveMenu = [...activeMenu]
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10);

    const highestIndirectShare = [...activeMenu]
      .filter((m) => m.totalCost > 0)
      .sort((a, b) => b.indirectSharePct - a.indirectSharePct)
      .slice(0, 10);

    const highestFoodCost = [...activeMenu]
      .filter((m) => m.suggestedPrice > 0)
      .sort((a, b) => b.foodCostPct - a.foodCostPct)
      .slice(0, 10);

    const topExpensiveRecipes = [...activeRecipes]
      .filter((r) => r.costPerPortion > 0)
      .sort((a, b) => b.costPerPortion - a.costPerPortion)
      .slice(0, 10);

    const zeroCostMenu = activeMenu.filter((m) => m.totalCost <= 0).slice(0, 20);

    res.json({
      defaults: { margin: DEFAULT_MARGIN, tax: DEFAULT_TAX },
      kpis,
      operational: {
        latest: latestOperational,
        history: operationalRows,
        breakdown: operationalBreakdown,
      },
      menuItems: menuRows,
      recipes: recipeRows,
      rankings: {
        topExpensiveMenu,
        highestIndirectShare,
        highestFoodCost,
        topExpensiveRecipes,
        zeroCostMenu,
      },
    });
  } catch (error) {
    console.error('getCostsReport:', error);
    res.status(500).json({ error: 'Error interno al generar el reporte de costos' });
  }
};
