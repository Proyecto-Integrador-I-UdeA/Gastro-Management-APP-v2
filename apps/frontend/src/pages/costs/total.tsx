"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import Button from "@/components/Button";
import { showError } from "@/utils/toast";
import { apiFetch } from "@/lib/api";

export default function TotalCostPage() {

  const [type, setType] = useState<"recipe" | "menu">("menu");

  const [recipes, setRecipes] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);

  const [selectedId, setSelectedId] = useState("");
  const [result, setResult] = useState<any>(null);


  // 🔥 cargar datos
  const fetchData = async () => {
    try {
      const [recipesData, menuData] = await Promise.all([
        apiFetch("/recipes"),
        apiFetch("/menu-items"),
      ]);

      const recipesList = Array.isArray(recipesData)
        ? recipesData
        : recipesData.recipes || recipesData.data || [];

      const menuList = Array.isArray(menuData)
        ? menuData
        : menuData.menuItems || menuData.data || [];

      setRecipes(recipesList);
      setMenuItems(menuList.filter((m: any) => m.active));

    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);


  // 🔥 calcular costo
  const handleCalculate = async () => {

    if (!selectedId) {
      return showError("Selecciona una opción");
    }

    try {

      let endpoint = "";

      if (type === "recipe") {
        endpoint = `/costs/recipe/${selectedId}`;
      } else {
        endpoint = `/costs/menu-item/${selectedId}`;
      }

      const data = await apiFetch(endpoint, {
        method: "GET",
      });

      setResult(data);

    } catch (error) {
      console.error(error);
    }
  };


  return (
    <DashboardLayout>

      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">
        Cálculo de Costos
      </h1>

      <div className="bg-gray-400/20 backdrop-blur-md p-6 rounded-2xl space-y-6">

        {/* 🔥 SELECT TIPO */}
        <div>
          <label className="text-sm text-gray-600">Tipo</label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as any);
              setSelectedId("");
              setResult(null);
            }}
            className="border p-2 rounded w-full"
          >
            <option value="menu">Platos del menú</option>
            <option value="recipe">Recetas</option>
          </select>
        </div>


        {/* 🔥 SELECT DINÁMICO */}
        <div>
          <label className="text-sm text-gray-600">
            {type === "menu" ? "Seleccionar plato" : "Seleccionar receta"}
          </label>

          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="border p-2 rounded w-full"
          >
            <option value="">-- Seleccionar --</option>

            {type === "recipe" &&
              recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  🍳 {r.name}
                </option>
              ))}

            {type === "menu" &&
              menuItems.map((m) => (
                <option key={m.id} value={m.id}>
                  🍽 {m.name}
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

            {/* 🧂 RECETA */}
            {type === "recipe" && (
              <>
                <div>
                  <strong>Ingredientes:</strong>
                  <p>${result.ingredientsCost?.toFixed(2) || "0.00"}</p>
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
              </>
            )}

            {/* 🍽 PLATO */}
            {type === "menu" && (
              <>
                <div>
                  <strong>Costo base:</strong>
                  <p>${result.baseCost?.toFixed(2) || "0.00"}</p>
                </div>

                <div>
                  <strong>Costos indirectos:</strong>
                  <p>${result.indirectCost?.toFixed(2) || "0.00"}</p>
                </div>

                <div>
                  <strong>Costo total plato:</strong>
                  <p className="text-blue-600 font-bold">
                    ${result.totalCost?.toFixed(2) || "0.00"}
                  </p>
                </div>
              </>
            )}

          </div>

        </div>
      )}

    </DashboardLayout>
  );
}