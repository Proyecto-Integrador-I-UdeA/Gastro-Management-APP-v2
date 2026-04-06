"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import Button from "@/components/Button";
import { showError } from "@/utils/toast";
import { apiFetch } from "@/lib/api"; // 🔥 IMPORTANTE

export default function TotalCostPage() {

  const [recipes, setRecipes] = useState<any[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState("");
  const [result, setResult] = useState<any>(null);

  // 🔥 cargar recetas
  const fetchRecipes = async () => {
    try {
      const data = await apiFetch("/recipes");

      const list = Array.isArray(data)
        ? data
        : data.recipes || data.data || [];

      setRecipes(list);

    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  // 🔥 calcular costo
  const handleCalculate = async () => {
    if (!selectedRecipe) return showError("Selecciona una receta");

    try {
      const data = await apiFetch(`/costs/recipe/${selectedRecipe}`, {
        method: "POST",
      });

      setResult(data);

    } catch (error) {
      console.error(error);
    }
  };

  return (
    <DashboardLayout>

      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">
        Cálculo de Costo por Plato
      </h1>

      <div className="bg-gray-400/20 backdrop-blur-md p-6 rounded-2xl space-y-6">

        {/* SELECT RECETA */}
        <div>
          <label className="text-sm text-gray-600">Seleccionar receta</label>
          <select
            value={selectedRecipe}
            onChange={(e) => setSelectedRecipe(e.target.value)}
            className="border p-2 rounded w-full"
          >
            <option value="">-- Seleccionar --</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <Button onClick={handleCalculate}>
          Calcular costo
        </Button>

      </div>

      {/* 🔥 RESULTADOS */}
      {result && (
        <div className="mt-10 bg-white rounded-xl p-6 shadow space-y-4">

          <h2 className="text-xl font-semibold">
            Resultado del costo
          </h2>

          <div className="grid grid-cols-2 gap-4">

            <div>
              <strong>Ingredientes:</strong>
              <p>${result.ingredientsCost?.toFixed(2) || "0.00"}</p>
            </div>

            <div>
              <strong>Costos prorrateados:</strong>
              <p>${result.indirectCostPerUnit?.toFixed(2) || "0.00"}</p>
            </div>

            <div>
              <strong>Costo total receta:</strong>
              <p>${result.totalCost?.toFixed(2) || "0.00"}</p>
            </div>

            <div>
              <strong>Costo por porción:</strong>
              <p className="text-blue-600 font-bold">
                ${result.costPerPortion?.toFixed(2) || "0.00"}
              </p>
            </div>

          </div>

        </div>
      )}

    </DashboardLayout>
  );
}