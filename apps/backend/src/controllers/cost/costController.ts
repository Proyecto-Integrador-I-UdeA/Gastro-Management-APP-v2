import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


// 🔥 CALCULAR COSTO DE RECETA (SOLO INGREDIENTES)
export const calculateRecipeCost = async (req: Request, res: Response) => {
  try {
    const recipeId = Number.parseInt(req.params.id, 10);

    if (Number.isNaN(recipeId)) {
      return res.status(400).json({ error: 'Invalid recipe id' });
    }

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // 🔹 SOLO INGREDIENTES
    const ingredientsCost = recipe.items.reduce((sum: number, item: any) => {
      const quantity = Number(item.quantity ?? 0);
      const productUnitCost = Number(item.product?.unitCost ?? 0);
      const baseQty = Number(item.product?.inputUnitQuantity ?? 1);

      const itemCost = (quantity / baseQty) * productUnitCost;

      return sum + itemCost;
    }, 0);

    const portions = Number(recipe.portions ?? 1);

    const costPerPortion = portions > 0
      ? ingredientsCost / portions
      : 0;

    res.json({
      recipeId,
      ingredientsCost,
      totalCost: ingredientsCost,
      costPerPortion
    });

  } catch (error) {
    console.error('❌ Error calculando receta:', error);
    res.status(500).json({ error: 'Error interno' });
  }
};




// 🔥 CALCULAR COSTO DE PLATO (NUEVO)
export const calculateMenuItemCost = async (req: Request, res: Response) => {
  try {
    const menuItemId = Number(req.params.id);

    if (Number.isNaN(menuItemId)) {
      return res.status(400).json({ error: 'Invalid menu item id' });
    }

    // 🔹 obtener plato con componentes
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: menuItemId },
      include: {
        components: {
          include: {
            product: true,
            recipe: {
              include: {
                items: {
                  include: {
                    product: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    // 🔹 COSTO BASE (ingredientes + recetas)
    const baseCost = menuItem.components.reduce((sum: number, comp: any) => {

      const quantity = Number(comp.quantity ?? 0);

      // 🧂 PRODUCTO DIRECTO
      if (comp.product) {
        const productUnitCost = Number(comp.product.unitCost ?? 0);
        const baseQty = Number(comp.product.inputUnitQuantity ?? 1);

        const cost = (quantity / baseQty) * productUnitCost;

        return sum + cost;
      }

      // 🍳 RECETA
      if (comp.recipe) {

  const recipeCostTotal = comp.recipe.items.reduce((rSum: number, item: any) => {
    const qty = Number(item.quantity ?? 0);
    const productUnitCost = Number(item.product?.unitCost ?? 0);
    const baseQty = Number(item.product?.inputUnitQuantity ?? 1);

    const itemCost = (qty / baseQty) * productUnitCost;

    return rSum + itemCost;
  }, 0);

  const portions = Number(comp.recipe.portions ?? 1);

  const costPerPortion = portions > 0
    ? recipeCostTotal / portions
    : 0;

  return sum + (costPerPortion * quantity);
}
      return sum;

    }, 0);


    // 🔥 COSTOS INDIRECTOS (SOLO AQUÍ)
    const latestCosts = await prisma.operationalCostConfig .findFirst({
      orderBy: { createdAt: 'desc' }
    });

    let indirectCost = 0;

    if (latestCosts) {
      const totalMonthlyCosts =
        Number(latestCosts.fixedCosts ?? 0) +
        Number(latestCosts.variableCosts ?? 0) +
        Number(latestCosts.payroll ?? 0);

      const production = Number(latestCosts.monthlyProduction ?? 1);

      const costPerUnit = production > 0
        ? totalMonthlyCosts / production
        : 0;

      indirectCost = costPerUnit;
    }

    const totalCost = baseCost + indirectCost;

    res.json({
      menuItemId,
      baseCost,
      indirectCost,
      totalCost
    });

  } catch (error) {
    console.error('❌ Error calculando plato:', error);
    res.status(500).json({ error: 'Error interno' });
  }
};




// 🔥 CREAR OTROS COSTOS
export const createOtherCosts = async (req: Request, res: Response) => {
  try {
    const { month, fixedCosts, variableCosts, payroll, monthlyProduction } = req.body;

    const data = await prisma.operationalCostConfig.create({
      data: {
        month,
        fixedCosts: Number(fixedCosts),
        variableCosts: Number(variableCosts),
        payroll: Number(payroll),
        monthlyProduction: Number(monthlyProduction),
      }
    });

    res.status(201).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error guardando costos' });
  }
};


// 🔥 LISTAR OTROS COSTOS
export const getOtherCosts = async (req: Request, res: Response) => {
  try {
    const data = await prisma.operationalCostConfig.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error listando costos' });
  }
};


// 🔥 ACTUALIZAR OTROS COSTOS
export const updateOtherCosts = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { month, fixedCosts, variableCosts, payroll, monthlyProduction } = req.body;

    const data = await prisma.operationalCostConfig.update({
      where: { id },
      data: {
        month,
        fixedCosts: Number(fixedCosts),
        variableCosts: Number(variableCosts),
        payroll: Number(payroll),
        monthlyProduction: Number(monthlyProduction),
      }
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error actualizando costos' });
  }
};


// 🔥 ELIMINAR
export const deleteOtherCosts = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    await prisma.operationalCostConfig.delete({
      where: { id }
    });

    res.json({ message: 'Costos eliminados' });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando costos' });
  }
};
export const createVariableCosts = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      month,
      packagingCost,
      wastePercent,
      paymentProcessingPercent,
      platformCommissionPercent,
      extraVariableCost,
    } = req.body;

    const costs = await prisma.variableCosts.create({
      data: {
        month,
        packagingCost,
        wastePercent,
        paymentProcessingPercent,
        platformCommissionPercent,
        extraVariableCost,
      },
    });

    res.status(201).json(costs);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error creando costos variables",
    });
  }
};
export const createCostCategories = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      month,
      production,
      operation,
      distribution,
      commercial,
      administration,
    } = req.body;

    const categories =
      await prisma.costCategory.create({
        data: {
          month,
          production,
          operation,
          distribution,
          commercial,
          administration,
        },
      });

    res.status(201).json(categories);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error:
        "Error creando categorías de costos",
    });
  }
};

export const getVariableCosts = async (
  req: Request,
  res: Response
) => {
  try {
    const costs = await prisma.variableCosts.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(costs);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error obteniendo costos variables",
    });
  }
};


export const updateVariableCosts = async (
  req: Request,
  res: Response
) => {
  try {
    const id = Number(req.params.id);

    const {
      month,
      packagingCost,
      wastePercent,
      paymentProcessingPercent,
      platformCommissionPercent,
      extraVariableCost,
    } = req.body;

    const updated = await prisma.variableCosts.update({
      where: { id },
      data: {
        month,
        packagingCost,
        wastePercent,
        paymentProcessingPercent,
        platformCommissionPercent,
        extraVariableCost,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error actualizando costos variables",
    });
  }
};

export const deleteVariableCosts = async (
  req: Request,
  res: Response
) => {
  try {
    const id = Number(req.params.id);

    await prisma.variableCosts.delete({
      where: { id },
    });

    res.json({
      message: "Costos variables eliminados",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error eliminando costos variables",
    });
  }
};
export const getCostCategories = async (
  req: Request,
  res: Response
) => {
  try {
    const categories =
      await prisma.costCategory.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });

    res.json(categories);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error:
        "Error obteniendo categorías de costos",
    });
  }
};
export const updateCostCategories = async (
  req: Request,
  res: Response
) => {
  try {
    const id = Number(req.params.id);

    const {
      month,
      production,
      operation,
      distribution,
      commercial,
      administration,
    } = req.body;

    const updated =
      await prisma.costCategory.update({
        where: { id },

        data: {
          month,
          production,
          operation,
          distribution,
          commercial,
          administration,
        },
      });

    res.json(updated);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error:
        "Error actualizando categorías de costos",
    });
  }
};
export const deleteCostCategories = async (
  req: Request,
  res: Response
) => {
  try {
    const id = Number(req.params.id);

    await prisma.costCategory.delete({
      where: { id },
    });

    res.json({
      message:
        "Categoría de costos eliminada",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error:
        "Error eliminando categoría de costos",
    });
  }
};