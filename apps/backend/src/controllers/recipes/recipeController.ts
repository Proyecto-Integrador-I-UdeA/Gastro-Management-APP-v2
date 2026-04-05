import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getRecipeById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        processes: true // 🔥 quitamos orderBy por ahora
      },
    });

    if (!recipe) {
      return res.status(404).json({ error: "Receta no encontrada" });
    }

    res.json(recipe);

  } catch (error) {
    console.error("Error obteniendo receta:", error);
    res.status(500).json({ error: "Error interno" });
  }
};

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

    const ingredientsCost = recipe.items.reduce((sum, item) => {
      return sum + Number(item.totalCost);
    }, 0);

    const totalTime = recipe.processes.reduce((sum, process) => {
      return sum + process.duration;
    }, 0);

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

    if (!name || !items || items.length === 0) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    const productIds = items.map((item: any) => item.productId);

    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isIngredient: true
      }
    });

    const productMap = new Map(products.map(p => [p.id, p]));

    const recipeItems = items.map((item: any) => {
      const product = productMap.get(item.productId);

      if (!product) {
        throw new Error(`Producto inválido: ${item.productId}`);
      }

      const unitCost = Number(item.unitCost ?? 0);
      const totalCost =
        item.totalCost != null
          ? Number(item.totalCost)
          : unitCost * Number(item.quantity);

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitCost,
        totalCost
      };
    });

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
          create: (processes || []).map((p: any, index: number) => ({
            name: p.name,
            processType: p.processType || 'standard',
            duration: Number(p.duration),
            operators: Number(p.operators),
            stepDescription: p.stepDescription ?? null,
            stepOrder: p.order != null ? Number(p.order) : index + 1,
          }))
        },
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

// ✅ UPDATE LIMPIO Y FUNCIONAL
export const updateRecipe = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, portions, description, processes, items } = req.body;

    console.log("🔥 PROCESSES:", processes);

    // 🔹 actualizar receta
    await prisma.recipe.update({
      where: { id },
      data: {
        name,
        portions,
        description
      }
    });

    // 🔹 eliminar procesos anteriores
    await prisma.recipeProcess.deleteMany({
      where: { recipeId: id }
    });

    // 🔹 crear procesos nuevos
    if (processes && processes.length > 0) {
      for (let index = 0; index < processes.length; index++) {
        const p = processes[index];
        await prisma.recipeProcess.create({
          data: {
            recipeId: id,
            name: p.name,
            duration: Number(p.duration),
            operators: Number(p.operators),
             stepDescription: p.stepDescription,
            processType: p.processType || 'standard',
            stepOrder: p.order != null ? Number(p.order) : index + 1,
          }
        });
      }
    }
    // 🔴 4. ELIMINAR INGREDIENTES
    await prisma.recipeItem.deleteMany({
      where: { recipeId: id }
    });

    // 🔴 5. CREAR INGREDIENTES
    if (items && items.length > 0) {
      for (const item of items) {

        if (!item.productId) continue; // evita vacíos

        await prisma.recipeItem.create({
          data: {
            recipeId: id,
            productId: Number(item.productId),
            quantity: Number(item.quantity),
            unitCost: Number(item.unitCost || 0),
            totalCost: Number(item.totalCost || 0),
          }
        });

      }
    }
    res.json({ message: "Receta actualizada correctamente" });

  
  } catch (error) {
    console.error("❌ ERROR:", error);
    res.status(500).json({ error: "Error interno" });
  }
};