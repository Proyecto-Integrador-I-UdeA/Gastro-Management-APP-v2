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
    } catch (error) {
      console.error("❌ Error cargando receta:", error);
      showError("Error cargando receta");
    }
  };

  const fetchProducts = async () => {
    try {
      const data = await apiFetch("/products");
      setProducts(data);
    } catch (error) {
      console.error("❌ Error cargando productos:", error);
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
    } catch (error) {
      console.error(error);
      showError("Error al guardar receta");
    }
  };

  if (loading) return <div>Cargando...</div>;
  if (!recipe) return <div>Error cargando receta</div>;

  return (
    <DashboardLayout>

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

              const unitLabels: Record<string, string> = {
                g: "gramos (g)",
                kg: "kilogramos (kg)",
                ml: "mililitros (ml)",
                l: "litros (l)",
              };

              return (
                <div key={index} className="mb-2">

                  <div className="flex gap-2">

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
                      min="0"
                      className="border p-2 rounded w-1/4"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...recipe.items];
                        updated[index].quantity = Number(e.target.value);
                        setRecipe({ ...recipe, items: updated });
                      }}
                    />

                    <button
                      onClick={() => {
                        const updated = recipe.items.filter((_, i) => i !== index);
                        setRecipe({ ...recipe, items: updated });
                      }}
                      className="bg-red-500 text-white px-2 rounded"
                    >
                      X
                    </button>

                  </div>

                  {/* 🔥 MENSAJE DINÁMICO */}
                  {selectedProduct && (
                    <p className="text-xs text-gray-500 mt-1">
                      Ingrese la cantidad en{" "}
                      {unitLabels[selectedProduct.unitOfMeasure] ||
                        selectedProduct.unitOfMeasure}
                    </p>
                  )}

                </div>
              );
            })}
          </div>
        )}

        {viewMode === "preparation" && (
          <div>

            <button
              onClick={addProcess}
              className="mb-4 bg-blue-500 text-white px-4 py-2 rounded"
            >
              + Agregar proceso
            </button>

            {processes.map((p, index) => (
              <div key={index} className="mb-4 p-4 border rounded">

                <input
                  placeholder="Proceso"
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

                <textarea
                  placeholder="Descripción"
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
    </DashboardLayout>
  );
}