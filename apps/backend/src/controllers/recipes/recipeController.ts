import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getRecipeSummary = async (req: Request, res: Response) => {
  try {
    const id = Number.parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: {
        items: true,
        processes: true
      }
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // 🔹 1. Costo de ingredientes
    const ingredientsCost = recipe.items.reduce((sum, item) => {
      return sum + Number(item.totalCost);
    }, 0);

    // 🔹 2. Tiempo total
    const totalTime = recipe.processes.reduce((sum, process) => {
      return sum + process.duration;
    }, 0);

    // 🔹 3. Tiempo de mano de obra
    const laborTime = recipe.processes.reduce((sum, process) => {
      return sum + (process.duration * process.operators);
    }, 0);

    let ingredientsCostPerPortion = 0;

if (recipe.portions && recipe.portions > 0) {
  ingredientsCostPerPortion = ingredientsCost / recipe.portions;
}

    res.json({
      recipeId: recipe.id,
      name: recipe.name,
      ingredientsCost,
      totalTime,
      laborTime,
      ingredientsCostPerPortion
    });

  } catch (error) {
    console.error('Error al obtener resumen de receta:', error);
    res.status(500).json({ error: 'Error interno' });
  }
};

export const listRecipes = async (req: Request, res: Response) => {
  try {
    const recipes = await prisma.recipe.findMany({
      include: {
        items: {
          include: { product: true }
        },
        processes: true
      },
      orderBy: { id: 'asc' }
    });

    res.json(recipes);
  } catch (error) {
    console.error('Error al listar recetas:', error);
    res.status(500).json({ error: 'Error interno' });
  }
};
export const createRecipe = async (req: Request, res: Response) => {
  try {
    const { name, description, batchQuantity, portions, items, processes } = req.body;

    // 1. Validación básica
    if (!name || !items || items.length === 0) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    // 2. Obtener productos (para costos)
    const productIds = items.map((item: any) => item.productId);

    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isIngredient: true
      }
    });

    // 3. Crear mapa de productos
    const productMap = new Map(products.map(p => [p.id, p]));

    // 4. Construir items con costo
    const recipeItems = items.map((item: any) => {
      const product = productMap.get(item.productId);

      if (!product) {
        throw new Error(`Producto inválido o no es ingrediente: ${item.productId}`);
      }

      const unitCost = Number(product.unitCost);
      const totalCost = unitCost * item.quantity;

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitCost,
        totalCost
      };
    });

    // 5. Crear receta con relaciones
    const recipe = await prisma.recipe.create({
      data: {
        name,
        description,
        batchQuantity,
        portions,
        items: {
          create: recipeItems
        },
        processes: {
          create: processes || []
        }
      },
      include: {
        items: true,
        processes: true
      }
    });

    res.status(201).json(recipe);

  } catch (error) {
    console.error('Error al crear receta:', error);
    res.status(500).json({ error: 'Error interno al crear receta' });
  }
};