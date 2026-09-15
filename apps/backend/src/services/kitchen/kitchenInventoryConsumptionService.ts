import { MovementType, Prisma, ProductBaseUnit } from '@prisma/client';
import { applyInventoryMovement } from '../inventoryMovementService';
import { SalesOperationError } from '../sales/salesOrderService';
import { costPerBaseUnit } from '../pricing/productUnitCost';
import { InvalidCostComponentError } from '../pricing/pricingErrors';
import {
  applyWasteFactor,
  getGlobalWastePercent,
} from '../pricing/globalWasteService';

type Ingredient = {
  productId: number;
  recipeId: number | null;
  quantity: Prisma.Decimal;
  unit: ProductBaseUnit;
  unitCost: Prisma.Decimal;
};

function positive(value: Prisma.Decimal.Value, context: string) {
  const parsed = new Prisma.Decimal(value);
  if (!parsed.isFinite() || parsed.lte(0)) {
    throw new SalesOperationError(
      'INVALID_KITCHEN_CONSUMPTION_QUANTITY',
      422,
      `${context} debe ser mayor que cero`,
    );
  }
  return parsed;
}

function kitchenProductUnitCost(
  product: {
    inputUnit: string;
    inputUnitQuantity: Prisma.Decimal.Value;
    unitCost: Prisma.Decimal.Value;
    unitOfMeasure: ProductBaseUnit;
  },
): Prisma.Decimal {
  try {
    return costPerBaseUnit(product);
  } catch (error) {
    if (error instanceof InvalidCostComponentError) {
      throw new SalesOperationError(
        'INVALID_KITCHEN_PRODUCT_UNIT',
        422,
        `No se puede convertir la unidad del producto para consumo: ${error.message}`,
      );
    }
    throw error;
  }
}

async function expandRecipe(
  transaction: Prisma.TransactionClient,
  recipeId: number,
  portionsRequired: Prisma.Decimal,
  ancestry: readonly number[],
): Promise<Ingredient[]> {
  if (ancestry.includes(recipeId)) {
    throw new SalesOperationError(
      'KITCHEN_RECIPE_CYCLE',
      422,
      `La receta ${recipeId} contiene una referencia circular`,
    );
  }
  const recipe = await transaction.recipe.findUnique({
    where: { id: recipeId },
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
              inputUnit: true,
              inputUnitQuantity: true,
              unitCost: true,
              unitOfMeasure: true,
            },
          },
        },
      },
    },
  });
  if (!recipe) return [];
  if (!Number.isInteger(recipe.portions) || recipe.portions <= 0) {
    throw new SalesOperationError(
      'INVALID_KITCHEN_RECIPE',
      422,
      `La receta ${recipeId} no tiene porciones válidas`,
    );
  }

  const scale = portionsRequired.div(recipe.portions);
  const ingredients: Ingredient[] = [];
  for (const item of recipe.items) {
    const hasProduct = item.productId !== null;
    const hasSubRecipe = item.subRecipeId !== null;
    if (hasProduct === hasSubRecipe) {
      throw new SalesOperationError(
        'INVALID_KITCHEN_RECIPE_ITEM',
        422,
        `El ingrediente ${item.id} debe referenciar un producto o una subreceta`,
      );
    }
    const scaledQuantity = positive(item.quantity, `Cantidad del ingrediente ${item.id}`).mul(scale);
    if (hasSubRecipe) {
      ingredients.push(...await expandRecipe(
        transaction,
        item.subRecipeId!,
        scaledQuantity,
        [...ancestry, recipeId],
      ));
      continue;
    }
    if (!item.product) {
      throw new SalesOperationError(
        'INVALID_KITCHEN_PRODUCT',
        422,
        `El ingrediente ${item.id} referencia un producto inexistente`,
      );
    }
    ingredients.push({
      productId: item.product.id,
      recipeId,
      quantity: scaledQuantity,
      unit: item.product.unitOfMeasure,
      unitCost: kitchenProductUnitCost(item.product),
    });
  }
  return ingredients;
}

async function ingredientsForDispatchItem(
  transaction: Prisma.TransactionClient,
  kitchenDispatchItemId: number,
) {
  const dispatchItem = await transaction.kitchenDispatchItem.findUnique({
    where: { id: kitchenDispatchItemId },
    select: {
      id: true,
      quantitySnapshot: true,
      salesOrderItem: {
        select: {
          menuItem: {
            select: {
              components: {
                select: {
                  id: true,
                  quantity: true,
                  productId: true,
                  recipeId: true,
                  product: {
                    select: {
                      id: true,
                      inputUnit: true,
                      inputUnitQuantity: true,
                      unitCost: true,
                      unitOfMeasure: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!dispatchItem) {
    throw new SalesOperationError('KITCHEN_DISPATCH_ITEM_NOT_FOUND', 404, 'Línea de cocina no encontrada');
  }

  const orderedQuantity = positive(dispatchItem.quantitySnapshot, 'Cantidad preparada');
  const expanded: Ingredient[] = [];
  for (const component of dispatchItem.salesOrderItem.menuItem.components) {
    const componentQuantity = positive(component.quantity, `Cantidad del componente ${component.id}`)
      .mul(orderedQuantity);
    const hasProduct = component.productId !== null;
    const hasRecipe = component.recipeId !== null;
    if (hasProduct === hasRecipe) {
      throw new SalesOperationError(
        'INVALID_KITCHEN_MENU_COMPONENT',
        422,
        `El componente ${component.id} debe referenciar un producto o una receta`,
      );
    }
    if (hasRecipe) {
      expanded.push(...await expandRecipe(transaction, component.recipeId!, componentQuantity, []));
    } else if (component.product) {
      expanded.push({
        productId: component.product.id,
        recipeId: null,
        quantity: componentQuantity,
        unit: component.product.unitOfMeasure,
        unitCost: kitchenProductUnitCost(component.product),
      });
    } else {
      throw new SalesOperationError(
        'INVALID_KITCHEN_PRODUCT',
        422,
        `El componente ${component.id} referencia un producto inexistente`,
      );
    }
  }

  const aggregated = new Map<number, Ingredient>();
  for (const ingredient of expanded) {
    const current = aggregated.get(ingredient.productId);
    if (!current) {
      aggregated.set(ingredient.productId, ingredient);
    } else {
      current.quantity = current.quantity.plus(ingredient.quantity);
      if (current.recipeId !== ingredient.recipeId) current.recipeId = null;
    }
  }
  return [...aggregated.values()];
}

export async function consumeKitchenDispatchInventory(
  transaction: Prisma.TransactionClient,
  kitchenDispatchId: number,
  actorId: number,
) {
  const existing = await transaction.kitchenInventoryConsumption.findUnique({
    where: { kitchenDispatchId },
    select: { id: true },
  });
  if (existing) return existing;

  const dispatch = await transaction.kitchenDispatch.findUnique({
    where: { id: kitchenDispatchId },
    select: { items: { select: { id: true } } },
  });
  if (!dispatch) {
    throw new SalesOperationError('KITCHEN_DISPATCH_NOT_FOUND', 404, 'Envío a cocina no encontrado');
  }

  const wastePercent = await getGlobalWastePercent(transaction);
  const prepared = [] as Array<{
    kitchenDispatchItemId: number;
    ingredient: Ingredient;
    adjustedQuantity: Prisma.Decimal;
    theoreticalCost: Prisma.Decimal;
    totalCost: Prisma.Decimal;
  }>;
  const issues: Array<{ code: string; kitchenDispatchItemId: number }> = [];

  for (const item of dispatch.items) {
    const ingredients = await ingredientsForDispatchItem(transaction, item.id);
    if (ingredients.length === 0) {
      issues.push({ code: 'MENU_ITEM_WITHOUT_CONSUMABLE_COMPONENTS', kitchenDispatchItemId: item.id });
    }
    for (const ingredient of ingredients) {
      const adjustedQuantity = applyWasteFactor(ingredient.quantity, wastePercent);
      const theoreticalCost = ingredient.quantity.mul(ingredient.unitCost);
      prepared.push({
        kitchenDispatchItemId: item.id,
        ingredient,
        adjustedQuantity,
        theoreticalCost,
        totalCost: adjustedQuantity.mul(ingredient.unitCost),
      });
    }
  }

  const warehouses = await transaction.warehouse.findMany({
    where: { kitchenConsumption: true, active: true },
    select: { id: true },
    take: 2,
  });
  if (warehouses.length === 0) {
    throw new SalesOperationError(
      'KITCHEN_CONSUMPTION_WAREHOUSE_NOT_CONFIGURED',
      409,
      'No hay una bodega configurada para consumo de Cocina. Configure una desde Bodegas.',
    );
  }
  if (warehouses.length > 1) {
    throw new SalesOperationError(
      'KITCHEN_CONSUMPTION_WAREHOUSE_AMBIGUOUS',
      409,
      'Hay varias bodegas activas configuradas para consumo de Cocina. Corrija la configuración desde Bodegas.',
    );
  }

  const theoreticalCost = prepared.reduce(
    (sum, row) => sum.plus(row.theoreticalCost),
    new Prisma.Decimal(0),
  );
  const totalCost = prepared.reduce(
    (sum, row) => sum.plus(row.totalCost),
    new Prisma.Decimal(0),
  );
  const consumption = await transaction.kitchenInventoryConsumption.create({
    data: {
      kitchenDispatchId,
      warehouseId: warehouses[0].id,
      wastePercentSnapshot: wastePercent,
      theoreticalCost,
      wasteCost: totalCost.minus(theoreticalCost),
      totalCost,
      issues: issues.length > 0 ? issues : undefined,
    },
    select: { id: true },
  });

  for (const row of prepared) {
    const movement = await applyInventoryMovement(
      transaction,
      MovementType.CONSUMPTION,
      {
        productId: row.ingredient.productId,
        quantity: row.adjustedQuantity.toNumber(),
        sourceWarehouseId: warehouses[0]!.id,
        notes: `Consumo automático Cocina · dispatch #${kitchenDispatchId}`,
        allowNegativeStock: true,
      },
      actorId,
    );
    await transaction.kitchenInventoryConsumptionItem.create({
      data: {
        consumptionId: consumption.id,
        kitchenDispatchItemId: row.kitchenDispatchItemId,
        productId: row.ingredient.productId,
        recipeId: row.ingredient.recipeId,
        inventoryMovementId: movement.id,
        theoreticalQuantity: row.ingredient.quantity,
        adjustedQuantity: row.adjustedQuantity,
        unit: row.ingredient.unit,
        unitCostSnapshot: row.ingredient.unitCost,
        theoreticalCost: row.theoreticalCost,
        wasteCost: row.totalCost.minus(row.theoreticalCost),
        totalCost: row.totalCost,
      },
    });
  }
  return consumption;
}
