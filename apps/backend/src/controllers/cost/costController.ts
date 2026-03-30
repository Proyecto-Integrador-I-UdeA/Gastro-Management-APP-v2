import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const calculateRecipeCost = async (req: Request, res: Response) => {
  try {
    const recipeId = Number.parseInt(req.params.id, 10);
    const { margin } = req.body;

    if (Number.isNaN(recipeId)) {
      return res.status(400).json({ error: 'Invalid recipe id' });
    }

    // 🔹 1. Obtener resumen de receta
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        items: true,
        processes: true
      }
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // 🔹 2. Ingredientes
    const ingredientsCost = recipe.items.reduce((sum, item) => {
      return sum + Number(item.totalCost);
    }, 0);

    // 🔹 3. Mano de obra
    const laborTime = recipe.processes.reduce((sum, p) => {
      return sum + (p.duration * p.operators);
    }, 0);

    const costPerMinute = 50; // 🔥 configurable después
    const laborCost = laborTime * costPerMinute;

    // 🔹 4. Costos indirectos (prorrateo)
    const costs = await prisma.cost.findMany();

    const totalMonthlyCosts = costs.reduce((sum, c) => sum + c.monthlyValue, 0);

    const estimatedMonthlyProduction = 1000; // 🔥 configurable después

    const indirectCostPerUnit = totalMonthlyCosts / estimatedMonthlyProduction;

    // 🔹 5. Costo total receta
    const totalCost =
      ingredientsCost +
      laborCost +
      indirectCostPerUnit;

    // 🔹 6. Costo por porción
    const costPerPortion = totalCost / recipe.portions;

    // 🔹 7. Precio de venta
    const salePrice = costPerPortion * (1 + margin);

    res.json({
      recipeId,
      ingredientsCost,
      laborCost,
      indirectCostPerUnit,
      costPerPortion,
      salePrice
    });

  } catch (error) {
    console.error('Error calculando costos:', error);
    res.status(500).json({ error: 'Error interno' });
  }
};