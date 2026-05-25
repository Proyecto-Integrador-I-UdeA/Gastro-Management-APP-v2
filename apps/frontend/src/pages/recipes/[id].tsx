"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import Button from "@/components/Button";
import { showError, showSuccess } from "@/utils/toast";
import { apiFetch } from "@/lib/api";

export default function RecipeDetail() {
  const router = useRouter();
  const { id } = router.query;
  const recipeId = Array.isArray(id) ? id[0] : id;

  const [recipe, setRecipe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processes, setProcesses] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"ingredients" | "preparation">(
    "ingredients"
  );
  const [editIngredients, setEditIngredients] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);

  const fetchRecipe = async () => {
    if (!recipeId) return;
   
    try {
    const data = await apiFetch(`/recipes/${recipeId}`);
console.log("RECIPE DATA:", data);

const normalizedItems = (data.items || []).map(
  (item: any) => ({
    itemType: item.subRecipeId
      ? "recipe"
      : "product",

    productId: item.productId || "",
    subRecipeId: item.subRecipeId || "",
    quantity: Number(item.quantity || 0),
  })
);

setRecipe({
  ...data,
  items: normalizedItems,
});

setProcesses(data.processes || []);
    
    
    
    } catch {
      showError("Error cargando receta");
    }
  };

  const fetchProducts = async () => {
    try {
      const data = await apiFetch("/products");
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      console.error("Error cargando productos");
    }
  };
  const fetchRecipes = async () => {
  try {
    const data = await apiFetch("/recipes");
    setRecipes(Array.isArray(data) ? data : []);
  } catch {
    console.error("Error cargando recetas");
  }
};

  useEffect(() => {
    if (router.isReady && recipeId) {
      const loadData = async () => {
        setLoading(true);
        await Promise.all([
  fetchRecipe(),
  fetchProducts(),
  fetchRecipes(),
]);
        setLoading(false);
      };

      loadData();
    }
  }, [router.isReady, recipeId]);

  const addProcess = () => {
    setProcesses([
      ...processes,
      {
        name: "",
        duration: 0,
        operators: 1,
        stepDescription: "",
      },
    ]);
  };

  const handleProcessChange = (
    index: number,
    field: string,
    value: any
  ) => {
    const updated = [...processes];
    updated[index][field] = value;
    setProcesses(updated);
  };

  const updateRecipeItems = (updatedItems: any[]) => {
    setRecipe({
      ...recipe,
      items: updatedItems,
    });
  };

 const addIngredient = () => {
  updateRecipeItems([
    ...(recipe.items || []),
    {
      itemType: "product",
      productId: "",
      subRecipeId: "",
      quantity: 0,
    },
  ]);
};

  const removeIngredient = (index: number) => {
    const updated = recipe.items.filter(
      (_: any, i: number) => i !== index
    );

    updateRecipeItems(updated);
  };

  const handleIngredientChange = (
    index: number,
    field: string,
    value: any
  ) => {
    const updated = [...recipe.items];
    updated[index][field] = value;
    updateRecipeItems(updated);
  };

  const saveAll = async () => {
    try {
      await apiFetch(`/recipes/${recipeId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: recipe.name,
          portions: recipe.portions,
          description: recipe.description,
          processes,
          items: recipe.items,
        }),
      });

      showSuccess("Receta guardada correctamente");
    } catch {
      showError("Error al guardar receta");
    }
  };

  const analytics = useMemo(() => {
  if (!recipe?.items?.length) {
    return {
      totalCost: 0,
      costPerPortion: 0,
      caloriesPerPortion: 0,
      fatPerPortion: 0,
      carbsPerPortion: 0,
      proteinPerPortion: 0,
      sodiumPerPortion: 0,
      sugarPerPortion: 0,
      macroPercentages: {
        fat: 0,
        carbs: 0,
        protein: 0,
      },
      nutritionScore: 100,
      alerts: [],
    };
  }

  let totalCost = 0;
  let totalCalories = 0;
  let totalFat = 0;
  let totalCarbs = 0;
  let totalProtein = 0;
  let totalSodium = 0;
  let totalSugar = 0;

  const detailed = recipe.items.map((item: any) => {
    // PRODUCTO
    if (item.itemType === "product") {
      const product = products.find(
        (p) => p.id === Number(item.productId)
      );

      if (!product) {
        return {
          cost: 0,
          itemName: "",
        };
      }

      const quantity = Number(item.quantity || 0);
      const unitCost = Number(product.unitCost || 0);
      const cost = unitCost * quantity;

      totalCost += cost;

      const calories =
        ((product.caloriesPer100g || 0) * quantity) / 100;

      const fat =
        ((product.fatPer100g || 0) * quantity) / 100;

      const carbs =
        ((product.carbsPer100g || 0) * quantity) / 100;

      const protein =
        ((product.proteinPer100g || 0) * quantity) / 100;

      const sodium =
        ((product.sodiumPer100g || 0) * quantity) / 100;

      const sugar =
        ((product.sugarPer100g || 0) * quantity) / 100;

      totalCalories += calories;
      totalFat += fat;
      totalCarbs += carbs;
      totalProtein += protein;
      totalSodium += sodium;
      totalSugar += sugar;

      return {
        cost,
        itemName: product.name,
      };
    }

    // SUB-RECETA
    if (item.itemType === "recipe") {
      const subRecipe = recipes.find(
        (r) => r.id === Number(item.subRecipeId)
      );

      if (!subRecipe) {
        return {
          cost: 0,
          itemName: "",
        };
      }

      const quantity = Number(item.quantity || 0);

      const costPerPortion =
        Number(subRecipe.totalCost || 0) /
        Math.max(Number(subRecipe.portions || 1), 1);

      const cost = costPerPortion * quantity;

      totalCost += cost;

      totalCalories +=
        Number(subRecipe.caloriesPerPortion || 0) * quantity;

      totalFat +=
        Number(subRecipe.fatPerPortion || 0) * quantity;

      totalCarbs +=
        Number(subRecipe.carbsPerPortion || 0) * quantity;

      totalProtein +=
        Number(subRecipe.proteinPerPortion || 0) * quantity;

      totalSodium +=
        Number(subRecipe.sodiumPerPortion || 0) * quantity;

      totalSugar +=
        Number(subRecipe.sugarPerPortion || 0) * quantity;

      return {
        cost,
        itemName: subRecipe.name,
      };
    }

    return {
      cost: 0,
      itemName: "",
    };
  });

  const safePortions =
    recipe.portions > 0 ? recipe.portions : 1;

  const costPerPortion = totalCost / safePortions;
  const caloriesPerPortion = totalCalories / safePortions;
  const fatPerPortion = totalFat / safePortions;
  const carbsPerPortion = totalCarbs / safePortions;
  const proteinPerPortion = totalProtein / safePortions;
  const sodiumPerPortion = totalSodium / safePortions;
  const sugarPerPortion = totalSugar / safePortions;

  const fatCalories = fatPerPortion * 9;
  const carbCalories = carbsPerPortion * 4;
  const proteinCalories = proteinPerPortion * 4;

  const macroEnergyTotal =
    fatCalories + carbCalories + proteinCalories;

  const macroPercentages = {
    fat: macroEnergyTotal
      ? (fatCalories / macroEnergyTotal) * 100
      : 0,
    carbs: macroEnergyTotal
      ? (carbCalories / macroEnergyTotal) * 100
      : 0,
    protein: macroEnergyTotal
      ? (proteinCalories / macroEnergyTotal) * 100
      : 0,
  };

 const alerts: string[] = [];

if (recipe?.nutritionRole === "CARB_BASE") {
  if (caloriesPerPortion > 500) {
    alerts.push("Calorías elevadas para acompañamiento carbohidrato");
  }

  if (macroPercentages.fat > 30) {
    alerts.push("Exceso de grasa para base carbohidrato");
  }

  if (sodiumPerPortion > 700) {
    alerts.push("Sodio elevado para acompañamiento");
  }

  if (costPerPortion > 7000) {
    alerts.push("Costo alto para base carbohidrato");
  }
}

else if (recipe?.nutritionRole === "PROTEIN_BASE") {
  if (macroPercentages.protein < 30) {
    alerts.push("Proteína insuficiente para proteína principal");
  }

  if (caloriesPerPortion > 700) {
    alerts.push("Carga calórica elevada");
  }

  if (macroPercentages.fat > 45) {
    alerts.push("Exceso de grasa en proteína principal");
  }

  if (sodiumPerPortion > 900) {
    alerts.push("Sodio elevado");
  }

  if (costPerPortion > 15000) {
    alerts.push("Costo premium");
  }
}

else if (recipe?.nutritionRole === "FAT_BASE") {
  if (caloriesPerPortion > 600) {
    alerts.push("Densidad calórica muy alta");
  }

  if (sodiumPerPortion > 800) {
    alerts.push("Sodio elevado");
  }

  if (sugarPerPortion > 15) {
    alerts.push("Azúcar elevada");
  }
}

else {
  if (caloriesPerPortion > 650) {
    alerts.push("Carga calórica elevada");
  }

  if (sodiumPerPortion > 850) {
    alerts.push("Sodio elevado");
  }

  if (sugarPerPortion > 20) {
    alerts.push("Azúcar elevada");
  }
}


  let nutritionScore = 100 - alerts.length * 8;

  if (nutritionScore < 0) {
    nutritionScore = 0;
  }

  return {
    totalCost,
    costPerPortion,
    caloriesPerPortion,
    fatPerPortion,
    carbsPerPortion,
    proteinPerPortion,
    sodiumPerPortion,
    sugarPerPortion,
    macroPercentages,
    nutritionScore,
    alerts,
  };
}, [recipe, products, recipes]);




  if (loading) return <div>Cargando...</div>;
  if (!recipe) return <div>Error cargando receta</div>;

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* IZQUIERDA */}
        <div className="lg:col-span-2">
          <div className="mb-6 space-y-4">
            <input
              value={recipe.name}
              onChange={(e) =>
                setRecipe({
                  ...recipe,
                  name: e.target.value,
                })
              }
              className="text-2xl font-bold border p-2 rounded w-full"
            />

            <input
              type="number"
              min="1"
              value={recipe.portions}
              onChange={(e) =>
                setRecipe({
                  ...recipe,
                  portions: Math.max(1, Number(e.target.value)),
                })
              }
              className="border p-2 rounded w-40"
            />
          </div>

          <div className="flex gap-4 mb-6">
            <Button
              type="button"
              onClick={() => {
                setViewMode("ingredients");
                setEditIngredients(true);
              }}
            >
              Ingredientes
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setViewMode("preparation");
                setEditIngredients(false);
              }}
            >
              Procesos
            </Button>
          </div>

          <div className="p-6 bg-white rounded shadow">
            {/* INGREDIENTES */}
            {viewMode === "ingredients" && editIngredients && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <Button type="button" onClick={addIngredient}>
                    + Agregar ingrediente
                  </Button>

                  <Button type="button" onClick={saveAll}>
                    Guardar receta completa
                  </Button>
                </div>
        {recipe.items.map((item: any, index: number) => {
  const selectedProduct = products.find(
    (p) => p.id === Number(item.productId)
  );

  return (
    <div
      key={index}
      className="mb-4 border rounded-xl p-4 bg-gray-50"
    >
      <div className="flex gap-2 items-center">
        <select
          className="border p-2 rounded w-1/4"
          value={item.itemType || "product"}
          onChange={(e) => {
            handleIngredientChange(
              index,
              "itemType",
              e.target.value
            );

            handleIngredientChange(
              index,
              "productId",
              ""
            );

            handleIngredientChange(
              index,
              "subRecipeId",
              ""
            );
          }}
        >
          <option value="product">
            Ingrediente
          </option>
          <option value="recipe">
            Sub-receta
          </option>
        </select>

        {item.itemType === "recipe" ? (
          <select
            className="border p-2 rounded w-2/4"
            value={item.subRecipeId || ""}
            onChange={(e) =>
              handleIngredientChange(
                index,
                "subRecipeId",
                Number(e.target.value)
              )
            }
          >
            <option value="">
              Seleccionar sub-receta
            </option>

            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        ) : (
          <select
            className="border p-2 rounded w-2/4"
            value={item.productId || ""}
            onChange={(e) =>
              handleIngredientChange(
                index,
                "productId",
                Number(e.target.value)
              )
            }
          >
            <option value="">
              Seleccionar producto
            </option>

            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        <input
          type="number"
          className="border p-2 rounded w-1/4 text-right"
          value={item.quantity}
          onChange={(e) =>
            handleIngredientChange(
              index,
              "quantity",
              Number(e.target.value)
            )
          }
        />

        <button
          onClick={() => removeIngredient(index)}
          className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg"
        >
          ✕
        </button>
      </div>
    {item.itemType === "product" && selectedProduct && (
  <p className="text-xs text-gray-500 mt-2">
    Unidad: {selectedProduct.unitOfMeasure}
  </p>
)}

{item.itemType === "recipe" && (
  <p className="text-xs text-gray-500 mt-2">
    Unidad: porciones
  </p>
)}
  
  
  
  
  
  
    </div>
  );
})}

              </div>
            )}

            {/* PROCESOS */}
            {viewMode === "preparation" && (
              <div>
                <Button
                  type="button"
                  onClick={addProcess}
                  className="mb-4"
                >
                  + Agregar proceso
                </Button>

                {processes.map((p, index) => (
                  <div
                    key={index}
                    className="mb-4 p-4 border rounded relative"
                  >
                    <button
                      onClick={() => {
                        const updated = processes.filter(
                          (_: any, i: number) => i !== index
                        );

                        setProcesses(updated);
                      }}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs"
                    >
                      ✕
                    </button>

                    <input
                      value={p.name}
                      onChange={(e) =>
                        handleProcessChange(
                          index,
                          "name",
                          e.target.value
                        )
                      }
                      className="border p-2 rounded w-full mb-2"
                    />

                    <input
                      type="number"
                      value={p.duration}
                      onChange={(e) =>
                        handleProcessChange(
                          index,
                          "duration",
                          Number(e.target.value)
                        )
                      }
                      className="border p-2 rounded w-full mb-2"
                    />

                    <textarea
                      placeholder="Descripción del proceso"
                      value={p.stepDescription || ""}
                      onChange={(e) =>
                        handleProcessChange(
                          index,
                          "stepDescription",
                          e.target.value
                        )
                      }
                      className="border p-2 rounded w-full"
                    />
                  </div>
                ))}

                <Button onClick={saveAll}>
                  Guardar receta completa
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* PANEL */}
        <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex justify-between">
            <span>Costo / porción</span>
            <span className="font-bold text-green-300">
              {new Intl.NumberFormat("es-CO", {
                style: "currency",
                currency: "COP",
                minimumFractionDigits: 0,
              }).format(analytics.costPerPortion)}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Calorías</span>
            <span className="font-bold">
              {analytics.caloriesPerPortion.toFixed(0)} kcal
            </span>
          </div>

          <div className="flex justify-between">
            <span>Proteína</span>
            <span className="font-bold text-green-300">
              {analytics.proteinPerPortion.toFixed(1)} g
            </span>
          </div>

          <div className="flex justify-between">
            <span>Carbohidratos</span>
            <span className="font-bold text-blue-300">
              {analytics.carbsPerPortion.toFixed(1)} g
            </span>
          </div>

          <div className="flex justify-between">
            <span>Grasas</span>
            <span className="font-bold">
              {analytics.fatPerPortion.toFixed(1)} g
            </span>
          </div>

          <div className="flex justify-between">
            <span>Sodio</span>
            <span className="font-bold">
              {analytics.sodiumPerPortion.toFixed(0)} mg
            </span>
          </div>

          <div className="flex justify-between">
            <span>Azúcar</span>
            <span className="font-bold">
              {analytics.sugarPerPortion.toFixed(1)} g
            </span>
          </div>

          <hr className="border-white/20" />

          <div>
            <h3 className="font-semibold mb-3">
              Balance Nutricional
            </h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Proteína</span>
                <span>
                  {analytics.macroPercentages.protein.toFixed(1)}%
                </span>
              </div>

              <div className="flex justify-between">
                <span>Carbohidratos</span>
                <span>
                  {analytics.macroPercentages.carbs.toFixed(1)}%
                </span>
              </div>

              <div className="flex justify-between">
                <span>Grasas</span>
                <span>
                  {analytics.macroPercentages.fat.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <hr className="border-white/20" />

<div>
  <h3 className="font-semibold mb-3">
    Clasificación nutricional
  </h3>

  <div className="space-y-2 text-sm">
    <div className="flex justify-between">
      <span>Macro dominante</span>
      <span className="font-bold text-blue-300">
        {recipe?.macroDominance === "CARBS"
          ? "Carbohidratos"
          : recipe?.macroDominance === "PROTEIN"
          ? "Proteína"
          : recipe?.macroDominance === "FAT"
          ? "Grasas"
          : "Balanceado"}
      </span>
    </div>

    <div className="flex justify-between">
      <span>Rol nutricional</span>
      <span className="font-bold text-green-300">
        {recipe?.nutritionRole === "CARB_BASE"
          ? "Base de carbohidratos"
          : recipe?.nutritionRole === "PROTEIN_BASE"
          ? "Proteína principal"
          : recipe?.nutritionRole === "FAT_BASE"
          ? "Base grasa"
          : "Balanceado"}
      </span>
    </div>

    <div className="flex justify-between">
      <span>Clasificación costo</span>
      <span className="font-bold text-yellow-300">
        {recipe?.costClassification === "LOW"
          ? "Bajo"
          : recipe?.costClassification === "MEDIUM"
          ? "Medio"
          : recipe?.costClassification === "HIGH"
          ? "Alto"
          : recipe?.costClassification === "PREMIUM"
          ? "Premium"
          : "Sin clasificar"}
      </span>
    </div>
  </div>
</div>

          <hr className="border-white/20" />

          <div className="flex justify-between items-center">
            <span>Score nutricional</span>
            <span className="text-xl font-bold text-green-300">
              {analytics.nutritionScore}/100
            </span>
          </div>

          {analytics.alerts.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-400/30 p-3 rounded text-sm space-y-2">
              {analytics.alerts.map((a: string, i: number) => (
                <div key={i}>⚠️ {a}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}