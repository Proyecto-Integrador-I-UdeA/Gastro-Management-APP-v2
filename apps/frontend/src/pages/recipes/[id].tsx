"use client";

import { useEffect, useState } from "react";
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
  const [viewMode, setViewMode] = useState<"ingredients" | "preparation">("ingredients");
  const [editIngredients, setEditIngredients] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  const fetchRecipe = async () => {
    if (!recipeId) return;
    try {
      const data = await apiFetch(`/recipes/${recipeId}`);
      setRecipe(data);
      setProcesses(data.processes || []);
    } catch {
      showError("Error cargando receta");
    }
  };

  const fetchProducts = async () => {
    try {
      const data = await apiFetch("/products");
      setProducts(data);
    } catch {
      console.error("Error cargando productos");
    }
  };

  useEffect(() => {
    if (router.isReady && recipeId) {
      const loadData = async () => {
        setLoading(true);
        await Promise.all([fetchRecipe(), fetchProducts()]);
        setLoading(false);
      };
      loadData();
    }
  }, [router.isReady, recipeId]);

  const addProcess = () => {
    setProcesses([
      ...processes,
      { name: "", duration: 0, operators: 1, stepDescription: "" }
    ]);
  };

  const handleProcessChange = (index: number, field: string, value: any) => {
    const updated = [...processes];
    updated[index][field] = value;
    setProcesses(updated);
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
          items: recipe.items
        }),
      });

      showSuccess("Receta guardada correctamente");
    } catch {
      showError("Error al guardar receta");
    }
  };

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
              onChange={(e) => setRecipe({ ...recipe, name: e.target.value })}
              className="text-2xl font-bold border p-2 rounded w-full"
            />

            <input
              type="number"
              min="1"
              value={recipe.portions}
              onChange={(e) =>
                setRecipe({
                  ...recipe,
                  portions: Math.max(1, Number(e.target.value))
                })
              }
              className="border p-2 rounded w-40"
            />
          </div>

          <div className="flex gap-4 mb-6">
            <button
              onClick={() => {
                setViewMode("ingredients");
                setEditIngredients(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Ingredientes
            </button>

            <button
              onClick={() => {
                setViewMode("preparation");
                setEditIngredients(false);
              }}
              className="px-4 py-2 bg-gray-200 rounded"
            >
              Procesos
            </button>
          </div>

          <div className="p-6 bg-white rounded shadow">

            {/* 🔥 INGREDIENTES */}
            {viewMode === "ingredients" && editIngredients && (
              <div>
                <button
                  onClick={() =>
                    setRecipe({
                      ...recipe,
                      items: [...recipe.items, { productId: "", quantity: 0 }]
                    })
                  }
                  className="mb-3 bg-green-500 text-white px-3 py-1 rounded"
                >
                  + Agregar ingrediente
                </button>

                {recipe.items.map((item: any, index: number) => {
                  const selectedProduct = products.find(
                    (p) => p.id === Number(item.productId)
                  );

                  return (
                    <div key={index} className="mb-2">
                      <div className="flex gap-2 items-center">

                        <select
                          className="border p-2 rounded w-1/2"
                          value={item.productId || ""}
                          onChange={(e) => {
                            const updated = [...recipe.items];
                            updated[index].productId = Number(e.target.value);
                            setRecipe({ ...recipe, items: updated });
                          }}
                        >
                          <option value="">Seleccionar producto</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          className="border p-2 rounded w-1/4 text-right"
                          value={item.quantity}
                          onChange={(e) => {
                            const updated = [...recipe.items];
                            updated[index].quantity = Number(e.target.value);
                            setRecipe({ ...recipe, items: updated });
                          }}
                        />

                        <button
                          onClick={() => {
                            const updated = recipe.items.filter((_: any, i: number) => i !== index);
                            setRecipe({ ...recipe, items: updated });
                          }}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded"
                        >
                          ✕
                        </button>

                      </div>

                      {selectedProduct && (
                        <p className="text-xs text-gray-500 mt-1">
                          Unidad: {selectedProduct.unitOfMeasure}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 🔥 PROCESOS */}
            {viewMode === "preparation" && (
              <div>
                <button
                  onClick={addProcess}
                  className="mb-4 bg-blue-500 text-white px-4 py-2 rounded"
                >
                  + Agregar proceso
                </button>

                {processes.map((p, index) => (
                  <div key={index} className="mb-4 p-4 border rounded relative">

                    <button
                      onClick={() => {
                        const updated = processes.filter((_: any, i: number) => i !== index);
                        setProcesses(updated);
                      }}
                      className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs"
                    >
                      ✕
                    </button>

                    <input
                      value={p.name}
                      onChange={(e) =>
                        handleProcessChange(index, "name", e.target.value)
                      }
                      className="border p-2 rounded w-full mb-2"
                    />

                    <input
                      type="number"
                      value={p.duration}
                      onChange={(e) =>
                        handleProcessChange(index, "duration", Number(e.target.value))
                      }
                      className="border p-2 rounded w-full mb-2"
                    />

                    {/* 🔥 AQUÍ ESTABA LO QUE FALTABA */}
                    <textarea
                      placeholder="Descripción del proceso"
                      value={p.stepDescription || ""}
                      onChange={(e) =>
                        handleProcessChange(index, "stepDescription", e.target.value)
                      }
                      className="border p-2 rounded w-full"
                    />

                  </div>
                ))}
              </div>
            )}

            <Button onClick={saveAll}>
              Guardar receta completa
            </Button>

          </div>
        </div>
        

        <SmartPanel recipe={recipe} products={products} />
      </div>
    </DashboardLayout>
  );
}

function SmartPanel({ recipe, products }: any) {
  if (!recipe) return null;

  let totalCost = 0;
  let calories = 0;
  let fat = 0;
  let sodium = 0;
  let sugar = 0;

  recipe.items?.forEach((item: any) => {
    const product = products.find((p: any) => p.id === Number(item.productId));
    if (!product) return;

    const qty = item.quantity || 0;

    totalCost += (product.unitCost || 0) * qty;

    // 🔥 NUTRICIÓN (si no existen en tu producto, queda en 0)
    calories += (product.calories || 0) * qty;
    fat += (product.fat || 0) * qty;
    sodium += (product.sodium || 0) * qty;
    sugar += (product.sugar || 0) * qty;
  });

  const portions = recipe.portions || 1;

  const analytics = {
    costPerPortion: totalCost / portions,
    caloriesPerPortion: calories / portions,
    fatPerPortion: fat / portions,
    sodiumPerPortion: sodium / portions,
    sugarPerPortion: sugar / portions,
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
    }).format(value || 0);

  const formatNumber = (value: number) =>
    new Intl.NumberFormat("es-CO").format(value || 0);

  const getColor = (value: number, min: number, max: number) => {
    if (value < min) return "text-yellow-400";
    if (value > max) return "text-red-400";
    return "text-green-400";
  };

  const LIMITS = {
    cost: { min: 8000, max: 12000 },
    calories: { min: 700, max: 1000 },
    fat: { min: 35, max: 50 },
    sodium: { min: 800, max: 1200 },
    sugar: { min: 25, max: 40 },
  };

  return (
    <div className="bg-gradient-to-br from-[#0B1C39] to-[#1B2A4A] text-white rounded-2xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">

      {/* COSTO */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-gray-300">Costo por porción</span>
        <span className={`font-bold text-lg ${getColor(analytics.costPerPortion, LIMITS.cost.min, LIMITS.cost.max)}`}>
          {formatCurrency(analytics.costPerPortion)}
        </span>
      </div>

      {/* CALORÍAS */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-gray-300">Calorías</span>
        <span className={`font-bold ${getColor(analytics.caloriesPerPortion, LIMITS.calories.min, LIMITS.calories.max)}`}>
          {formatNumber(analytics.caloriesPerPortion)} kcal
        </span>
      </div>

      {/* GRASA */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-gray-300">Grasa</span>
        <span className={`font-bold ${getColor(analytics.fatPerPortion, LIMITS.fat.min, LIMITS.fat.max)}`}>
          {analytics.fatPerPortion.toFixed(1)}%
        </span>
      </div>

      {/* SODIO */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-gray-300">Sodio</span>
        <span className={`font-bold ${getColor(analytics.sodiumPerPortion, LIMITS.sodium.min, LIMITS.sodium.max)}`}>
          {formatNumber(analytics.sodiumPerPortion)} mg
        </span>
      </div>

      {/* AZÚCAR */}
      <div className="flex justify-between items-center">
        <span className="text-gray-300">Azúcar</span>
        <span className={`font-bold ${getColor(analytics.sugarPerPortion, LIMITS.sugar.min, LIMITS.sugar.max)}`}>
          {formatNumber(analytics.sugarPerPortion)} g
        </span>
      </div>

    </div>
  );
}




















