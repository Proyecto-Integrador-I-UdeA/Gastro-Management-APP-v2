import { Request, Response } from 'express';
import prisma from '../../lib/prisma';

export interface ProductionRecipeRow {
  recipeId: number;
  internalCode: string;
  name: string;
  active: boolean;
  portions: number;
  itemCount: number;
  processCount: number;
  totalProcessMinutes: number;
  costPerPortion: number | null;
  nutritionScore: number | null;
  nutritionRole: string | null;
  costClassification: string | null;
  usedInMenuCount: number;
  incomplete: boolean;
  missingProcesses: boolean;
}

export interface ProductionMenuRow {
  menuItemId: number;
  name: string;
  active: boolean;
  componentCount: number;
  recipeComponentCount: number;
  productComponentCount: number;
  totalCost: number | null;
  caloriesPerPortion: number | null;
  nutritionScore: number | null;
  hasDrink: boolean;
  hasDessert: boolean;
  incomplete: boolean;
}

function costPerPortion(totalCost: unknown, portions: number): number | null {
  const cost = Number(totalCost ?? NaN);
  if (!Number.isFinite(cost) || cost <= 0) return null;
  const p = portions > 0 ? portions : 1;
  return cost / p;
}

/**
 * Resumen de producción: recetas (componentes) y platos del menú.
 * Pensado para reportes (permiso `reports.read`).
 */
export const getProductionReport = async (_req: Request, res: Response) => {
  try {
    const [recipes, menuItems] = await Promise.all([
      prisma.recipe.findMany({
        orderBy: { internalCode: 'asc' },
        include: {
          items: { select: { id: true } },
          processes: { select: { duration: true, operators: true } },
          MenuItemComponent: { select: { id: true } },
        },
      }),
      prisma.menuItem.findMany({
        orderBy: { name: 'asc' },
        include: {
          components: {
            select: { id: true, recipeId: true, productId: true },
          },
        },
      }),
    ]);

    const recipeRows: ProductionRecipeRow[] = recipes.map((r) => {
      const portions = r.portions > 0 ? r.portions : 1;
      const totalProcessMinutes = r.processes.reduce(
        (sum, p) => sum + Number(p.duration ?? 0),
        0
      );
      const missingProcesses = r.processes.length === 0;
      const incomplete = r.items.length === 0 || missingProcesses;

      return {
        recipeId: r.id,
        internalCode: r.internalCode,
        name: r.name,
        active: r.active,
        portions: r.portions,
        itemCount: r.items.length,
        processCount: r.processes.length,
        totalProcessMinutes,
        costPerPortion: costPerPortion(r.totalCost, portions),
        nutritionScore: r.nutritionScore,
        nutritionRole: r.nutritionRole,
        costClassification: r.costClassification,
        usedInMenuCount: r.MenuItemComponent.length,
        incomplete,
        missingProcesses,
      };
    });

    const menuRows: ProductionMenuRow[] = menuItems.map((m) => {
      const recipeComponentCount = m.components.filter((c) => c.recipeId != null).length;
      const productComponentCount = m.components.filter((c) => c.productId != null).length;

      return {
        menuItemId: m.id,
        name: m.name,
        active: m.active,
        componentCount: m.components.length,
        recipeComponentCount,
        productComponentCount,
        totalCost: m.totalCost != null ? Number(m.totalCost) : null,
        caloriesPerPortion: m.caloriesPerPortion,
        nutritionScore: m.nutritionScore,
        hasDrink: m.hasDrink,
        hasDessert: m.hasDessert,
        incomplete: m.components.length === 0,
      };
    });

    const activeRecipes = recipeRows.filter((r) => r.active);
    const activeMenu = menuRows.filter((m) => m.active);

    const recipeCosts = activeRecipes
      .map((r) => r.costPerPortion)
      .filter((c): c is number => c != null);

    const menuCosts = activeMenu
      .map((m) => m.totalCost)
      .filter((c): c is number => c != null);

    const kpis = {
      totalRecipes: recipeRows.length,
      activeRecipes: activeRecipes.length,
      inactiveRecipes: recipeRows.length - activeRecipes.length,
      incompleteRecipes: recipeRows.filter((r) => r.incomplete).length,
      recipesMissingProcesses: recipeRows.filter((r) => r.missingProcesses).length,
      recipesNotInMenu: activeRecipes.filter((r) => r.usedInMenuCount === 0).length,
      totalMenuItems: menuRows.length,
      activeMenuItems: activeMenu.length,
      inactiveMenuItems: menuRows.length - activeMenu.length,
      incompleteMenuItems: menuRows.filter((m) => m.incomplete).length,
      menuItemsWithoutCost: activeMenu.filter((m) => m.totalCost == null || m.totalCost <= 0).length,
      avgRecipeCostPerPortion:
        recipeCosts.length > 0
          ? recipeCosts.reduce((a, b) => a + b, 0) / recipeCosts.length
          : null,
      avgMenuItemCost:
        menuCosts.length > 0
          ? menuCosts.reduce((a, b) => a + b, 0) / menuCosts.length
          : null,
    };

    const costClassCounts = new Map<string, number>();
    for (const r of activeRecipes) {
      const key = r.costClassification ?? 'SIN_CLASIFICAR';
      costClassCounts.set(key, (costClassCounts.get(key) ?? 0) + 1);
    }

    const costClassificationDistribution = [...costClassCounts.entries()].map(
      ([classification, count]) => ({ classification, count })
    );

    const nutritionRoleCounts = new Map<string, number>();
    for (const r of activeRecipes) {
      const key = r.nutritionRole ?? 'SIN_ROL';
      nutritionRoleCounts.set(key, (nutritionRoleCounts.get(key) ?? 0) + 1);
    }

    const nutritionRoleDistribution = [...nutritionRoleCounts.entries()].map(
      ([role, count]) => ({ role, count })
    );

    const topExpensiveRecipes = [...activeRecipes]
      .filter((r) => r.costPerPortion != null)
      .sort((a, b) => (b.costPerPortion ?? 0) - (a.costPerPortion ?? 0))
      .slice(0, 10);

    const topExpensiveMenuItems = [...activeMenu]
      .filter((m) => m.totalCost != null && m.totalCost > 0)
      .sort((a, b) => (b.totalCost ?? 0) - (a.totalCost ?? 0))
      .slice(0, 10);

    const longestProcessRecipes = [...activeRecipes]
      .filter((r) => r.totalProcessMinutes > 0)
      .sort((a, b) => b.totalProcessMinutes - a.totalProcessMinutes)
      .slice(0, 10);

    const standardizationGaps = recipeRows
      .filter((r) => r.active && (r.missingProcesses || r.itemCount === 0))
      .slice(0, 20);

    const orphanRecipes = activeRecipes
      .filter((r) => r.usedInMenuCount === 0)
      .slice(0, 20);

    const incompleteMenu = menuRows.filter((m) => m.active && m.incomplete).slice(0, 20);

    res.json({
      kpis,
      recipes: recipeRows,
      menuItems: menuRows,
      distributions: {
        costClassification: costClassificationDistribution,
        nutritionRole: nutritionRoleDistribution,
      },
      rankings: {
        topExpensiveRecipes,
        topExpensiveMenuItems,
        longestProcessRecipes,
        standardizationGaps,
        orphanRecipes,
        incompleteMenu,
      },
    });
  } catch (error) {
    console.error('getProductionReport:', error);
    res.status(500).json({ error: 'Error interno al generar el reporte de producción' });
  }
};
