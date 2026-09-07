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
  inputUnit: 'g',
  unitOfMeasure: 'g',
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
        product: {
          id: 1,
          inputUnit: 'g',
          unitOfMeasure: 'g',
          unitCost: '1.234567',
          inputUnitQuantity: '1',
        },
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
          inputUnit: 'g',
          unitOfMeasure: 'g',
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

  it('convierte la presentación de compra antes de costear producto directo', async () => {
    const result = await calculateMenuItemCost(1, sourceFor({
      components: [{
        id: 1,
        quantity: '200',
        productId: 1,
        recipeId: null,
        product: {
          id: 1,
          inputUnit: 'kg',
          unitOfMeasure: 'g',
          inputUnitQuantity: '1',
          unitCost: '18000',
        },
      }],
    }));

    expect(result.baseCost.toString()).toBe('3600');
  });

  it('ignora totales históricos de recetas y suma el caso real del plato', async () => {
    const productCost = (
      id: number,
      unitCost: string,
      inputUnit: 'kg' | 'lt' = 'kg',
    ) => ({
      id,
      inputUnit,
      unitOfMeasure: inputUnit === 'lt' ? 'ml' : 'g',
      inputUnitQuantity: '1',
      unitCost,
    });
    const chicken = productCost(1, '18000');
    const oil = productCost(2, '14000', 'lt');
    const salt = productCost(3, '3000');
    const potato = productCost(4, '4500');
    const lettuce = productCost(5, '5999');
    const tomato = productCost(6, '5500');
    const recipesWithHistoricalTotals = [
      {
        id: 1,
        portions: 1,
        totalCost: '5683000',
        items: [
          { id: 1, quantity: '300', productId: 1, subRecipeId: null, product: chicken },
          { id: 2, quantity: '20', productId: 2, subRecipeId: null, product: oil },
          { id: 3, quantity: '1', productId: 3, subRecipeId: null, product: salt },
        ],
      },
      {
        id: 2,
        portions: 1,
        totalCost: '903000',
        items: [
          { id: 4, quantity: '200', productId: 4, subRecipeId: null, product: potato },
          { id: 5, quantity: '1', productId: 3, subRecipeId: null, product: salt },
        ],
      },
      {
        id: 3,
        portions: 1,
        totalCost: '577950',
        items: [
          { id: 6, quantity: '50', productId: 5, subRecipeId: null, product: lettuce },
          { id: 7, quantity: '50', productId: 6, subRecipeId: null, product: tomato },
          { id: 8, quantity: '1', productId: 3, subRecipeId: null, product: salt },
        ],
      },
    ];
    const result = await calculateMenuItemCost(1, sourceFor({
      components: recipesWithHistoricalTotals.map(recipe => ({
        id: recipe.id,
        quantity: '1',
        productId: null,
        recipeId: recipe.id,
        product: null,
      })),
      recipes: recipesWithHistoricalTotals,
    }));

    expect(result.baseCost.toString()).toBe('7163.95');
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
