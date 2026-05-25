import { Request, Response } from "express";
import prisma from "../../lib/prisma";

export const listIngredientCatalog = async (
  _req: Request,
  res: Response
) => {
  try {
    const items = await prisma.ingredientCatalog.findMany({
      orderBy: {
        name: "asc",
      },
    });

    res.json(items);
  } catch (error) {
    console.error("Error listando catálogo:", error);
    res.status(500).json({
      error: "Error listando catálogo nutricional",
    });
  }
};

export const createIngredientCatalog = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      name,
      category,
      caloriesPer100g,
      carbsPer100g,
      fatPer100g,
      proteinPer100g,
      sugarPer100g,
      sodiumPer100g,
    } = req.body;

    const item = await prisma.ingredientCatalog.create({
      data: {
        name,
        category,
        caloriesPer100g: Number(caloriesPer100g) || 0,
        carbsPer100g: Number(carbsPer100g) || 0,
        fatPer100g: Number(fatPer100g) || 0,
        proteinPer100g: Number(proteinPer100g) || 0,
        sugarPer100g: Number(sugarPer100g) || 0,
        sodiumPer100g: Number(sodiumPer100g) || 0,
      },
    });

    res.json(item);
  } catch (error) {
    console.error("Error creando ingrediente:", error);
    res.status(500).json({
      error: "Error creando ingrediente nutricional",
    });
  }
};