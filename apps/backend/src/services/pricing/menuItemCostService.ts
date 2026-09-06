import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../../lib/prisma';
import {
  InvalidCostComponentError,
  InvalidOperationalCostConfigError,
  MenuItemCostNotFoundError,
  RecipeCostNotFoundError,
  RecipeCycleError,
} from './pricingErrors';

type DecimalValue = Prisma.Decimal.Value;

export type CostProduct = {
  id: number;
  unitCost: DecimalValue;
  inputUnitQuantity: DecimalValue;
};

export type CostMenuItemComponent = {
  id: number;
  quantity: DecimalValue;
  productId: number | null;
  recipeId: number | null;
  product: CostProduct | null;
};

export type CostRecipeItem = {
  id: number;
  quantity: DecimalValue;
  productId: number | null;
  subRecipeId: number | null;
  product: CostProduct | null;
};

export type CostRecipe = {
  id: number;
  portions: number;
  items: CostRecipeItem[];
};

export type OperationalCostValues = {
  fixedCosts: DecimalValue;
  variableCosts: DecimalValue;
  payroll: DecimalValue;
  monthlyProduction: DecimalValue | null;
};

export interface MenuItemCostDataSource {
  getMenuItem(id: number): Promise<{
    id: number;
    components: CostMenuItemComponent[];
  } | null>;
  getRecipe(id: number): Promise<CostRecipe | null>;
  getLatestOperationalCostConfig(): Promise<OperationalCostValues | null>;
}

export type MenuItemCostResult = {
  menuItemId: number;
  baseCost: Prisma.Decimal;
  indirectCost: Prisma.Decimal;
  totalCost: Prisma.Decimal;
};

export type RecipeCostResult = {
  recipeId: number;
  totalCost: Prisma.Decimal;
  costPerPortion: Prisma.Decimal;
};

type CostPrismaClient = PrismaClient | Prisma.TransactionClient;

function asDecimal(value: DecimalValue, field: string): Prisma.Decimal {
  try {
    const parsed = new Prisma.Decimal(value);
    if (!parsed.isFinite()) throw new Error();
    return parsed;
  } catch {
    throw new InvalidCostComponentError(`${field} no es un decimal válido`);
  }
}

function positiveDecimal(value: DecimalValue, field: string): Prisma.Decimal {
  const parsed = asDecimal(value, field);
  if (parsed.lte(0)) {
    throw new InvalidCostComponentError(`${field} debe ser mayor que 0`);
  }
  return parsed;
}

function nonNegativeDecimal(value: DecimalValue, field: string): Prisma.Decimal {
  const parsed = asDecimal(value, field);
  if (parsed.lt(0)) {
    throw new InvalidCostComponentError(`${field} no puede ser negativo`);
  }
  return parsed;
}

function calculateProductCost(
  product: CostProduct,
  quantityValue: DecimalValue,
  context: string,
): Prisma.Decimal {
  const quantity = positiveDecimal(quantityValue, `${context}.quantity`);
  const unitCost = nonNegativeDecimal(product.unitCost, `${context}.product.unitCost`);
  const inputUnitQuantity = positiveDecimal(
    product.inputUnitQuantity,
    `${context}.product.inputUnitQuantity`,
  );

  return quantity.div(inputUnitQuantity).mul(unitCost);
}

export function createPrismaMenuItemCostDataSource(
  client: CostPrismaClient = prisma,
): MenuItemCostDataSource {
  return {
    async getMenuItem(id) {
      return client.menuItem.findUnique({
        where: { id },
        select: {
          id: true,
          components: {
            select: {
              id: true,
              quantity: true,
              productId: true,
              recipeId: true,
              product: {
                select: {
                  id: true,
                  unitCost: true,
                  inputUnitQuantity: true,
                },
              },
            },
          },
        },
      });
    },
    async getRecipe(id) {
      return client.recipe.findUnique({
        where: { id },
        select: {
          id: true,
          portions: true,
          items: {
            select: {
              id: true,
              quantity: true,
              productId: true,
              subRecipeId: true,
              product: {
                select: {
                  id: true,
                  unitCost: true,
                  inputUnitQuantity: true,
                },
              },
            },
          },
        },
      });
    },
    async getLatestOperationalCostConfig() {
      return client.operationalCostConfig.findFirst({
        orderBy: { createdAt: 'desc' },
        select: {
          fixedCosts: true,
          variableCosts: true,
          payroll: true,
          monthlyProduction: true,
        },
      });
    },
  };
}

async function calculateRecipe(
  recipeId: number,
  source: MenuItemCostDataSource,
  ancestry: readonly number[],
): Promise<RecipeCostResult> {
  if (ancestry.includes(recipeId)) {
    throw new RecipeCycleError([...ancestry, recipeId]);
  }

  const recipe = await source.getRecipe(recipeId);
  if (!recipe) throw new RecipeCostNotFoundError(recipeId);
  if (!Number.isInteger(recipe.portions) || recipe.portions <= 0) {
    throw new InvalidCostComponentError(`La receta ${recipeId} debe tener portions mayor que 0`);
  }

  const nextAncestry = [...ancestry, recipeId];
  let totalCost = new Prisma.Decimal(0);

  for (const item of recipe.items) {
    const hasProduct = item.productId !== null;
    const hasSubRecipe = item.subRecipeId !== null;
    if (hasProduct === hasSubRecipe) {
      throw new InvalidCostComponentError(
        `RecipeItem ${item.id} debe referenciar exactamente un producto o una subreceta`,
      );
    }

    if (hasProduct) {
      if (!item.product) {
        throw new InvalidCostComponentError(`RecipeItem ${item.id} referencia un producto inexistente`);
      }
      totalCost = totalCost.plus(
        calculateProductCost(item.product, item.quantity, `RecipeItem ${item.id}`),
      );
      continue;
    }

    const subRecipe = await calculateRecipe(item.subRecipeId!, source, nextAncestry);
    const quantity = positiveDecimal(item.quantity, `RecipeItem ${item.id}.quantity`);
    totalCost = totalCost.plus(subRecipe.costPerPortion.mul(quantity));
  }

  return {
    recipeId,
    totalCost,
    costPerPortion: totalCost.div(recipe.portions),
  };
}

export function calculateRecipeCost(
  recipeId: number,
  source: MenuItemCostDataSource = createPrismaMenuItemCostDataSource(),
): Promise<RecipeCostResult> {
  return calculateRecipe(recipeId, source, []);
}

function calculateIndirectCost(
  config: OperationalCostValues | null,
): Prisma.Decimal {
  if (!config) return new Prisma.Decimal(0);

  const operationalDecimal = (
    value: DecimalValue,
    field: string,
  ): Prisma.Decimal => {
    try {
      const parsed = new Prisma.Decimal(value);
      if (!parsed.isFinite() || parsed.lt(0)) throw new Error();
      return parsed;
    } catch {
      throw new InvalidOperationalCostConfigError(`${field} debe ser un decimal no negativo`);
    }
  };

  const fixedCosts = operationalDecimal(config.fixedCosts, 'fixedCosts');
  const variableCosts = operationalDecimal(config.variableCosts, 'variableCosts');
  const payroll = operationalDecimal(config.payroll, 'payroll');
  const production = config.monthlyProduction === null
    ? new Prisma.Decimal(0)
    : operationalDecimal(config.monthlyProduction, 'monthlyProduction');

  if (production.isNegative()) {
    throw new InvalidOperationalCostConfigError('monthlyProduction no puede ser negativa');
  }

  const monthlyOverhead = fixedCosts.plus(variableCosts).plus(payroll);
  return production.gt(0) ? monthlyOverhead.div(production) : new Prisma.Decimal(0);
}

export async function calculateMenuItemCost(
  menuItemId: number,
  source: MenuItemCostDataSource = createPrismaMenuItemCostDataSource(),
): Promise<MenuItemCostResult> {
  const menuItem = await source.getMenuItem(menuItemId);
  if (!menuItem) throw new MenuItemCostNotFoundError();

  let baseCost = new Prisma.Decimal(0);
  for (const component of menuItem.components) {
    const hasProduct = component.productId !== null;
    const hasRecipe = component.recipeId !== null;
    if (hasProduct === hasRecipe) {
      throw new InvalidCostComponentError(
        `MenuItemComponent ${component.id} debe referenciar exactamente un producto o una receta`,
      );
    }

    if (hasProduct) {
      if (!component.product) {
        throw new InvalidCostComponentError(
          `MenuItemComponent ${component.id} referencia un producto inexistente`,
        );
      }
      baseCost = baseCost.plus(
        calculateProductCost(
          component.product,
          component.quantity,
          `MenuItemComponent ${component.id}`,
        ),
      );
      continue;
    }

    const recipe = await calculateRecipe(component.recipeId!, source, []);
    const quantity = positiveDecimal(
      component.quantity,
      `MenuItemComponent ${component.id}.quantity`,
    );
    baseCost = baseCost.plus(recipe.costPerPortion.mul(quantity));
  }

  const indirectCost = calculateIndirectCost(
    await source.getLatestOperationalCostConfig(),
  );

  return {
    menuItemId,
    baseCost,
    indirectCost,
    totalCost: baseCost.plus(indirectCost),
  };
}
