import { Request, Response } from 'express';
import { MovementType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
function calculateRecipeNutrition(
  items: any[],
  products: any[],
  subRecipes: any[],
  portions: number
) {
  let totalCost = 0;
  let totalCalories = 0;
  let totalFat = 0;
  let totalCarbs = 0;
  let totalProtein = 0;
  let totalSodium = 0;
  let totalSugar = 0;

  for (const item of items) {
    // PRODUCTO
    if (item.productId) {
      const product = products.find(
        (p) => p.id === Number(item.productId)
      );

      if (!product) continue;

      const quantity = Number(item.quantity || 0);
      const unitCost = Number(product.unitCost || 0);

      totalCost += unitCost * quantity;

      totalCalories +=
        (Number(product.caloriesPer100g || 0) *
          quantity) /
        100;

      totalFat +=
        (Number(product.fatPer100g || 0) *
          quantity) /
        100;

      totalCarbs +=
        (Number(product.carbsPer100g || 0) *
          quantity) /
        100;

      totalProtein +=
        (Number(product.proteinPer100g || 0) *
          quantity) /
        100;

      totalSodium +=
        (Number(product.sodiumPer100g || 0) *
          quantity) /
        100;

      totalSugar +=
        (Number(product.sugarPer100g || 0) *
          quantity) /
        100;
    }

    // SUB-RECETA
    if (item.subRecipeId) {
      const recipe = subRecipes.find(
        (r) => r.id === Number(item.subRecipeId)
      );

      if (!recipe) continue;

      const quantity = Number(item.quantity || 0);

      const costPerPortion =
        Number(recipe.totalCost || 0) /
        Math.max(Number(recipe.portions || 1), 1);

      totalCost += costPerPortion * quantity;

      totalCalories +=
        Number(recipe.caloriesPerPortion || 0) *
        quantity;

      totalFat +=
        Number(recipe.fatPerPortion || 0) *
        quantity;

      totalCarbs +=
        Number(recipe.carbsPerPortion || 0) *
        quantity;

      totalProtein +=
        Number(recipe.proteinPerPortion || 0) *
        quantity;

      totalSodium +=
        Number(recipe.sodiumPerPortion || 0) *
        quantity;

      totalSugar +=
        Number(recipe.sugarPerPortion || 0) *
        quantity;
    }
  }

  const safePortions = portions > 0 ? portions : 1;

  const costPerPortion = totalCost / safePortions;
  const caloriesPerPortion =
    totalCalories / safePortions;
  const fatPerPortion = totalFat / safePortions;
  const carbsPerPortion = totalCarbs / safePortions;
  const proteinPerPortion =
    totalProtein / safePortions;
  const sodiumPerPortion =
    totalSodium / safePortions;
  const sugarPerPortion =
    totalSugar / safePortions;

  // ENERGÍA POR MACRO
  const fatCalories = fatPerPortion * 9;
  const carbCalories = carbsPerPortion * 4;
  const proteinCalories = proteinPerPortion * 4;

  const macroEnergyTotal =
    fatCalories +
    carbCalories +
    proteinCalories;

  const carbPct = macroEnergyTotal
    ? (carbCalories / macroEnergyTotal) * 100
    : 0;

  const proteinPct = macroEnergyTotal
    ? (proteinCalories / macroEnergyTotal) * 100
    : 0;

  const fatPct = macroEnergyTotal
    ? (fatCalories / macroEnergyTotal) * 100
    : 0;

let macroDominance = "BALANCED";
let nutritionRole = "BALANCED";

// CLASIFICACIÓN FUNCIONAL (rol culinario)
// distinta de dominancia macro pura

if (carbPct >= 45 && carbPct >= proteinPct) {
  nutritionRole = "CARB_BASE";

  if (fatPct > carbPct) {
    macroDominance = "FAT";
  } else {
    macroDominance = "CARBS";
  }
}

else if (
  proteinPct >= 25 &&
  proteinPct >= carbPct
) {
  nutritionRole = "PROTEIN_BASE";

  if (fatPct > proteinPct) {
    macroDominance = "FAT";
  } else {
    macroDominance = "PROTEIN";
  }
}

else if (
  fatPct >= 60 &&
  carbPct < 20 &&
  proteinPct < 20
) {
  macroDominance = "FAT";
  nutritionRole = "FAT_BASE";
}

else {
  macroDominance = "BALANCED";
  nutritionRole = "BALANCED";
}












  // COSTO CONTEXTUAL
  let costClassification = "MEDIUM";

  if (nutritionRole === "CARB_BASE") {
    if (costPerPortion < 3000)
      costClassification = "LOW";
    else if (costPerPortion < 7000)
      costClassification = "MEDIUM";
    else costClassification = "HIGH";
  }

  if (nutritionRole === "PROTEIN_BASE") {
    if (costPerPortion < 6000)
      costClassification = "MEDIUM";
    else if (costPerPortion < 15000)
      costClassification = "HIGH";
    else costClassification = "PREMIUM";
  }

  if (nutritionRole === "FAT_BASE") {
    if (costPerPortion < 4000)
      costClassification = "LOW";
    else if (costPerPortion < 9000)
      costClassification = "MEDIUM";
    else costClassification = "HIGH";
  }

  // ALERTAS CONTEXTUALES
 
 // ALERTAS CONTEXTUALES POR ROL
let alerts = 0;

if (nutritionRole === "CARB_BASE") {
  if (caloriesPerPortion > 500) alerts++;
  if (fatPct > 30) alerts++;
  if (sodiumPerPortion > 700) alerts++;
  if (costClassification === "HIGH") alerts++;
}

else if (nutritionRole === "PROTEIN_BASE") {
  if (proteinPct < 30) alerts++;
  if (caloriesPerPortion > 700) alerts++;
  if (fatPct > 45) alerts++;
  if (sodiumPerPortion > 900) alerts++;
  if (costClassification === "PREMIUM") alerts++;
}

else if (nutritionRole === "FAT_BASE") {
  if (caloriesPerPortion > 600) alerts++;
  if (sodiumPerPortion > 800) alerts++;
  if (sugarPerPortion > 15) alerts++;
}

else {
  // BALANCED
  if (caloriesPerPortion > 650) alerts++;
  if (sodiumPerPortion > 850) alerts++;
  if (sugarPerPortion > 20) alerts++;
}
 

  let nutritionScore = 100 - alerts * 8;

  if (nutritionScore < 0) {
    nutritionScore = 0;
  }

  return {
    totalCost,
    caloriesPerPortion,
    proteinPerPortion,
    carbsPerPortion,
    fatPerPortion,
    sodiumPerPortion,
    sugarPerPortion,
    nutritionScore,
    macroDominance,
    nutritionRole,
    costClassification,
  };
}

export const getRecipeById = async (
  req: Request,
  res: Response
) => {
  try {
    const id = Number(req.params.id);

    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
            subRecipe: true,
          },
        },
        processes: true,
      },
    });

    if (!recipe) {
      return res.status(404).json({
        error: "Receta no encontrada",
      });
    }

    res.json(recipe);
  } catch (error) {
    console.error("Error obteniendo receta:", error);
    res.status(500).json({
      error: "Error interno",
    });
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
          include: { product: true, subRecipe: true, }
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
    // 🔥 FIX: agregar active aquí
    const { name, description, batchQuantity, portions, items, processes, active } = req.body;

    if (!name || !items || items.length === 0) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    const recipesWithCode = await prisma.recipe.findMany({
      where: {
        internalCode: {
          startsWith: "RC-",
        },
      },
      select: {
        internalCode: true,
      },
    });

    let maxNumber = 0;

    for (const r of recipesWithCode) {
      const num = parseInt(r.internalCode.split("-")[1]);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }

    const nextNumber = maxNumber + 1;
    const newCode = `RC-${String(nextNumber).padStart(3, "0")}`;

   const productIds = items
  .filter((item: any) => item.productId)
  .map((item: any) => Number(item.productId));

const subRecipeIds = items
  .filter((item: any) => item.subRecipeId)
  .map((item: any) => Number(item.subRecipeId));

const products = await prisma.product.findMany({
  where: {
    id: { in: productIds },
    isIngredient: true,
  },
});

const subRecipes = await prisma.recipe.findMany({
  where: {
    id: { in: subRecipeIds },
  },
});

const productMap = new Map(
  products.map((p) => [p.id, p])
);

const subRecipeMap = new Map(
  subRecipes.map((r) => [r.id, r])
);

const recipeItems = items.map((item: any) => {
  const quantity = Number(item.quantity || 0);

  // PRODUCTO
  if (item.productId) {
    const product = productMap.get(
      Number(item.productId)
    );

    if (!product) {
      throw new Error(
        `Producto inválido: ${item.productId}`
      );
    }

    const unitCost = Number(product.unitCost || 0);

    return {
      productId: Number(item.productId),
      quantity,
      unitCost,
      totalCost: unitCost * quantity,
    };
  }

  // SUB-RECETA
  if (item.subRecipeId) {
    const subRecipe = subRecipeMap.get(
      Number(item.subRecipeId)
    );

    if (!subRecipe) {
      throw new Error(
        `Sub-receta inválida: ${item.subRecipeId}`
      );
    }

    const unitCost =
      Number(subRecipe.totalCost || 0) /
      Math.max(Number(subRecipe.portions || 1), 1);

    return {
      subRecipeId: Number(item.subRecipeId),
      quantity,
      unitCost,
      totalCost: unitCost * quantity,
    };
  }

  throw new Error("Item inválido");
});

const nutrition = calculateRecipeNutrition(
  items,
  products,
  subRecipes,
  Number(portions)
);


    const recipe = await prisma.recipe.create({
    data: {
  internalCode: newCode,
  name,
  description,
  batchQuantity,
  portions,
  active: active ?? true,

  totalCost: nutrition.totalCost,

caloriesPerPortion: nutrition.caloriesPerPortion,
proteinPerPortion: nutrition.proteinPerPortion,
carbsPerPortion: nutrition.carbsPerPortion,
fatPerPortion: nutrition.fatPerPortion,
sodiumPerPortion: nutrition.sodiumPerPortion,
sugarPerPortion: nutrition.sugarPerPortion,
nutritionScore: nutrition.nutritionScore,

macroDominance: nutrition.macroDominance,
nutritionRole: nutrition.nutritionRole,
costClassification: nutrition.costClassification,

  items: {
    create: recipeItems
  },

  processes: {
    create: (processes || []).map(
      (p: any, index: number) => ({
        name: p.name,
        processType: p.processType || "standard",
        duration: Number(p.duration),
        operators: Number(p.operators),
        stepDescription: p.stepDescription ?? null,
        stepOrder:
          p.order != null
            ? Number(p.order)
            : index + 1,
      })
    )
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

// ✅ UPDATE RECIPE
  export const updateRecipe = async (
  req: Request,
  res: Response
) => {
  try {
    const id = Number(req.params.id);

    const {
      name,
      portions,
      description,
      processes,
      items,
      active,
    } = req.body;

    await prisma.recipe.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(portions !== undefined && {
          portions: Number(portions),
        }),
        ...(description !== undefined && {
          description,
        }),
        ...(active !== undefined && { active }),
      },
    });

    // procesos
    if (processes !== undefined) {
      await prisma.recipeProcess.deleteMany({
        where: { recipeId: id },
      });

      if (Array.isArray(processes) && processes.length > 0) {
        await prisma.recipeProcess.createMany({
          data: processes.map(
            (p: any, index: number) => ({
              recipeId: id,
              name: p.name,
              duration: Number(p.duration),
              operators: Number(p.operators),
              stepDescription:
                p.stepDescription ?? null,
              processType:
                p.processType || "standard",
              stepOrder:
                p.order != null
                  ? Number(p.order)
                  : index + 1,
            })
          ),
        });
      }
    }

    // items híbridos
    if (items !== undefined) {
      await prisma.recipeItem.deleteMany({
        where: { recipeId: id },
      });

      const productIds = items
        .filter((item: any) => item.productId)
        .map((item: any) =>
          Number(item.productId)
        );

      const subRecipeIds = items
        .filter((item: any) => item.subRecipeId)
        .map((item: any) =>
          Number(item.subRecipeId)
        );

      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
        },
      });

      const subRecipes = await prisma.recipe.findMany({
        where: {
          id: { in: subRecipeIds },
        },
      });

      const recipeItems: any[] = [];

      for (const item of items) {
        const quantity = Number(item.quantity || 0);

        // PRODUCTO
        if (item.productId) {
          const product = products.find(
            (p) =>
              p.id === Number(item.productId)
          );

          if (!product) continue;

          const unitCost = Number(
            product.unitCost || 0
          );

          recipeItems.push({
            recipeId: id,
            productId: Number(item.productId),
            quantity,
            unitCost,
            totalCost: unitCost * quantity,
          });
        }

        // SUB-RECETA
        if (item.subRecipeId) {
          const subRecipe = subRecipes.find(
            (r) =>
              r.id === Number(item.subRecipeId)
          );

          if (!subRecipe) continue;
         const unitCost =
         Number(subRecipe.totalCost || 0) /
         Math.max(Number(subRecipe.portions || 1), 1);
          
          
          

          recipeItems.push({
            recipeId: id,
            subRecipeId: Number(item.subRecipeId),
            quantity,
            unitCost,
            totalCost: unitCost * quantity,
          });
        }
      }

      if (recipeItems.length > 0) {
        await prisma.recipeItem.createMany({
          data: recipeItems,
        });
      }

      const currentRecipe =
        await prisma.recipe.findUnique({
          where: { id },
        });

      const nutrition = calculateRecipeNutrition(
        items,
        products,
        subRecipes,
        Number(
          portions ??
            currentRecipe?.portions ??
            1
        )
      );

  
  await prisma.recipe.update({
  where: { id },
  data: {
    totalCost: nutrition.totalCost,
    caloriesPerPortion:
      nutrition.caloriesPerPortion,
    proteinPerPortion:
      nutrition.proteinPerPortion,
    carbsPerPortion:
      nutrition.carbsPerPortion,
    fatPerPortion:
      nutrition.fatPerPortion,
    sodiumPerPortion:
      nutrition.sodiumPerPortion,
    sugarPerPortion:
      nutrition.sugarPerPortion,
    nutritionScore:
      nutrition.nutritionScore,

    macroDominance:
      nutrition.macroDominance,

    nutritionRole:
      nutrition.nutritionRole,

    costClassification:
      nutrition.costClassification,
  },
});  
    }

    res.json({
      message:
        "Receta actualizada correctamente",
    });
  } catch (error) {
    console.error(
      "Error actualizando receta:",
      error
    );

    res.status(500).json({
      error: "Error interno",
    });
  }
};

