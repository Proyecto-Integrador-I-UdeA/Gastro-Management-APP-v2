import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 🔥 CALCULAR COSTO DE RECETA (MODELO PRORRATEADO)
export const calculateRecipeCost = async (req: Request, res: Response) => {
  try {
    const recipeId = Number.parseInt(req.params.id, 10);

    if (Number.isNaN(recipeId)) {
      return res.status(400).json({ error: 'Invalid recipe id' });
    }

    // 🔹 1. Obtener receta con productos
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

    // 🔥 DEBUG CLAVE
    console.log("🧾 ITEMS RECIBIDOS:", recipe.items);

    // 🔹 2. Costo de ingredientes (RecipeItem.unitCost/totalCost; Product ya no tiene unitCost)
    const ingredientsCost = recipe.items.reduce((sum: number, item: any) => {
      const quantity = Number(item.quantity ?? 0);
      const unitCost = Number(item.unitCost ?? 0);
      const itemCost = Number(item.totalCost ?? quantity * unitCost);

      console.log("➡️ ITEM:", {
        productId: item.productId,
        quantity,
        unitCost,
        itemCost,
      });

      return sum + itemCost;
    }, 0);

    // 🔥 3. COSTOS INDIRECTOS
    const latestCosts = await prisma.otherCosts.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    let indirectCostPerUnit = 0;

    if (latestCosts) {
      const totalMonthlyCosts =
        Number(latestCosts.fixedCosts ?? 0) +
        Number(latestCosts.variableCosts ?? 0) +
        Number(latestCosts.payroll ?? 0);

      const production = Number(latestCosts.monthlyProduction ?? 1);

      indirectCostPerUnit = production > 0
        ? totalMonthlyCosts / production
        : 0;
    }

    // 🔹 4. Totales
    const portions = Number(recipe.portions ?? 1);

    const indirectCostTotal = indirectCostPerUnit * portions;

    const totalCost = ingredientsCost + indirectCostTotal;

    const costPerPortion = portions > 0
      ? totalCost / portions
      : 0;

    res.json({
      recipeId,
      ingredientsCost,
      indirectCostPerUnit,
      indirectCostTotal,
      totalCost,
      costPerPortion
    });

  } catch (error) {
    console.error('❌ Error calculando costos:', error);
    res.status(500).json({ error: 'Error interno' });
  }
};

// 🔥 CREAR OTROS COSTOS
export const createOtherCosts = async (req: Request, res: Response) => {
  try {
    const { month, fixedCosts, variableCosts, payroll, monthlyProduction } = req.body;

    const data = await prisma.otherCosts.create({
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
    const data = await prisma.otherCosts.findMany({
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

    const data = await prisma.otherCosts.update({
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

    await prisma.otherCosts.delete({
      where: { id }
    });

    res.json({ message: 'Costos eliminados' });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando costos' });
  }
};