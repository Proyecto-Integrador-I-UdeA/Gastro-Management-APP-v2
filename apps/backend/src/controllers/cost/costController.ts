import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import {
  calculateMenuItemCost as calculateMenuItemCostWithDecimal,
  calculateRecipeCost as calculateRecipeCostWithDecimal,
} from '../../services/pricing/menuItemCostService';
import {
  InvalidCostComponentError,
  InvalidOperationalCostConfigError,
  MenuItemCostNotFoundError,
  RecipeCostNotFoundError,
  RecipeCycleError,
} from '../../services/pricing/pricingErrors';

function handleCostCalculationError(error: unknown, res: Response) {
  if (error instanceof MenuItemCostNotFoundError || error instanceof RecipeCostNotFoundError) {
    return res.status(404).json({ error: error.message });
  }

  if (
    error instanceof RecipeCycleError
    || error instanceof InvalidCostComponentError
    || error instanceof InvalidOperationalCostConfigError
  ) {
    return res.status(422).json({ error: error.message });
  }

  console.error('Error calculando costo:', error);
  return res.status(500).json({ error: 'Error interno' });
}

// Contrato legado: mantiene números en la respuesta, aunque el cálculo interno usa Decimal.
export const calculateRecipeCost = async (req: Request, res: Response) => {
  const recipeId = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(recipeId)) {
    return res.status(400).json({ error: 'Invalid recipe id' });
  }

  try {
    const cost = await calculateRecipeCostWithDecimal(recipeId);
    return res.json({
      recipeId,
      ingredientsCost: cost.totalCost.toNumber(),
      totalCost: cost.totalCost.toNumber(),
      costPerPortion: cost.costPerPortion.toNumber(),
    });
  } catch (error) {
    return handleCostCalculationError(error, res);
  }
};

// Contrato legado: mantiene números en la respuesta, aunque el cálculo interno usa Decimal.
export const calculateMenuItemCost = async (req: Request, res: Response) => {
  const menuItemId = Number(req.params.id);
  if (!Number.isInteger(menuItemId) || menuItemId <= 0) {
    return res.status(400).json({ error: 'Invalid menu item id' });
  }

  try {
    const cost = await calculateMenuItemCostWithDecimal(menuItemId);
    return res.json({
      menuItemId,
      baseCost: cost.baseCost.toNumber(),
      indirectCost: cost.indirectCost.toNumber(),
      totalCost: cost.totalCost.toNumber(),
    });
  } catch (error) {
    return handleCostCalculationError(error, res);
  }
};

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
      },
    });
    return res.status(201).json(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error guardando costos' });
  }
};

export const getOtherCosts = async (_req: Request, res: Response) => {
  try {
    const data = await prisma.operationalCostConfig.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json(data);
  } catch {
    return res.status(500).json({ error: 'Error listando costos' });
  }
};

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
      },
    });
    return res.json(data);
  } catch {
    return res.status(500).json({ error: 'Error actualizando costos' });
  }
};

export const deleteOtherCosts = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await prisma.operationalCostConfig.delete({ where: { id } });
    return res.json({ message: 'Costos eliminados' });
  } catch {
    return res.status(500).json({ error: 'Error eliminando costos' });
  }
};
