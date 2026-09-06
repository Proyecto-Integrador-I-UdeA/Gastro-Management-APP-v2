import { describe, expect, it } from 'vitest';
import {
  calculateMenuItemCost,
  CostMenuItemComponent,
  CostRecipe,
  MenuItemCostDataSource,
} from '../../src/services/pricing/menuItemCostService';
import {
  InvalidCostComponentError,
  InvalidOperationalCostConfigError,
  RecipeCycleError,
} from '../../src/services/pricing/pricingErrors';

const product = {
  id: 1,
  unitCost: '100',
  inputUnitQuantity: '10',
};

function sourceFor(options: {
  components?: CostMenuItemComponent[];
  recipes?: CostRecipe[];
  config?: Awaited<ReturnType<MenuItemCostDataSource['getLatestOperationalCostConfig']>>;
} = {}): MenuItemCostDataSource {
  const recipes = new Map((options.recipes ?? []).map(recipe => [recipe.id, recipe]));
  return {
    async getMenuItem(id) {
      return { id, components: options.components ?? [] };
    },
    async getRecipe(id) {
      return recipes.get(id) ?? null;
    },
    async getLatestOperationalCostConfig() {
      return options.config ?? null;
    },
  };
}

describe('motor Decimal de costos de MenuItem', () => {
  it('calcula producto directo y costos indirectos vigentes', async () => {
    const result = await calculateMenuItemCost(1, sourceFor({
      components: [{
        id: 1,
        quantity: '5',
        productId: 1,
        recipeId: null,
        product,
      }],
      config: {
        fixedCosts: '700',
        variableCosts: '200',
        payroll: '100',
        monthlyProduction: '2',
      },
    }));

    expect(result.baseCost.toString()).toBe('50');
    expect(result.indirectCost.toString()).toBe('500');
    expect(result.totalCost.toString()).toBe('550');
  });

  it('conserva precisión superior a 4 decimales en el motor general', async () => {
    const result = await calculateMenuItemCost(1, sourceFor({
      components: [{
        id: 1,
        quantity: '1',
        productId: 1,
        recipeId: null,
        product: { id: 1, unitCost: '1.234567', inputUnitQuantity: '1' },
      }],
    }));

    expect(result.baseCost.toString()).toBe('1.234567');
    expect(result.totalCost.toString()).toBe('1.234567');
  });

  it('no impone al costo general el máximo de DECIMAL(14,4) de pricing', async () => {
    const result = await calculateMenuItemCost(1, sourceFor({
      components: [{
        id: 1,
        quantity: '1',
        productId: 1,
        recipeId: null,
        product: {
          id: 1,
          unitCost: '10000000000.25',
          inputUnitQuantity: '1',
        },
      }],
    }));

    expect(result.baseCost.toString()).toBe('10000000000.25');
    expect(result.totalCost.toString()).toBe('10000000000.25');
  });

  it('calcula receta directa respetando portions y cantidad de componente', async () => {
    const result = await calculateMenuItemCost(1, sourceFor({
      components: [{ id: 1, quantity: '2', productId: null, recipeId: 10, product: null }],
      recipes: [{
        id: 10,
        portions: 2,
        items: [{ id: 10, quantity: '10', productId: 1, subRecipeId: null, product }],
      }],
    }));

    expect(result.baseCost.toString()).toBe('100');
  });

  it('calcula subrecetas recursivas en varios niveles', async () => {
    const recipes: CostRecipe[] = [
      {
        id: 30,
        portions: 2,
        items: [{ id: 30, quantity: '10', productId: 1, subRecipeId: null, product }],
      },
      {
        id: 20,
        portions: 5,
        items: [{ id: 20, quantity: '3', productId: null, subRecipeId: 30, product: null }],
      },
      {
        id: 10,
        portions: 2,
        items: [{ id: 10, quantity: '4', productId: null, subRecipeId: 20, product: null }],
      },
    ];
    const result = await calculateMenuItemCost(1, sourceFor({
      components: [{ id: 1, quantity: '2', productId: null, recipeId: 10, product: null }],
      recipes,
    }));

    expect(result.baseCost.toString()).toBe('120');
  });

  it('detecta ciclos de recetas', async () => {
    const recipes: CostRecipe[] = [
      {
        id: 1,
        portions: 1,
        items: [{ id: 1, quantity: '1', productId: null, subRecipeId: 2, product: null }],
      },
      {
        id: 2,
        portions: 1,
        items: [{ id: 2, quantity: '1', productId: null, subRecipeId: 1, product: null }],
      },
    ];

    await expect(calculateMenuItemCost(1, sourceFor({
      components: [{ id: 1, quantity: '1', productId: null, recipeId: 1, product: null }],
      recipes,
    }))).rejects.toBeInstanceOf(RecipeCycleError);
  });

  it('rechaza un componente con referencias ambiguas', async () => {
    await expect(calculateMenuItemCost(1, sourceFor({
      components: [{ id: 1, quantity: '1', productId: 1, recipeId: 2, product }],
    }))).rejects.toBeInstanceOf(InvalidCostComponentError);
  });

  it('rechaza configuración operacional inválida', async () => {
    await expect(calculateMenuItemCost(1, sourceFor({
      config: {
        fixedCosts: '-1',
        variableCosts: '0',
        payroll: '0',
        monthlyProduction: '1',
      },
    }))).rejects.toBeInstanceOf(InvalidOperationalCostConfigError);
  });
});
