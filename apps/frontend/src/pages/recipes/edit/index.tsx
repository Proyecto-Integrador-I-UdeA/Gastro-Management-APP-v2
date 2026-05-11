"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { apiFetch } from "@/lib/api";

export default function EditRecipesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecipes = async () => {
    try {
      const data = await apiFetch("/recipes");

      const list = Array.isArray(data)
        ? data
        : data.recipes || data.data || [];

      setRecipes(list);
    } catch (error) {
      console.error("Error cargando recetas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  // 🔥 TOGGLE ACTIVO / INACTIVO
  const toggleActive = async (e: any, recipe: any) => {
    e.stopPropagation(); // 🔥 evita que abra la receta

    try {
      await apiFetch(`/recipes/${recipe.id}`, {
        method: "PUT",
        body: JSON.stringify({
          active: !recipe.active,
        }),
      });

      // actualizar estado local
      setRecipes((prev) =>
        prev.map((r) =>
          r.id === recipe.id ? { ...r, active: !recipe.active } : r
        )
      );
    } catch (error) {
      console.error("Error actualizando estado:", error);
    }
  };

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">
        Editar recetas
      </h1>

      {loading ? (
        <div className="text-center py-10">Cargando...</div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-10">
          ⚠️ No hay recetas registradas
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              onClick={() => router.push(`/recipes/${recipe.id}`)}
              className={`cursor-pointer rounded-2xl p-5 shadow-xl
              transition-all duration-300 flex flex-col justify-between border
              hover:scale-[1.03] hover:shadow-2xl
              ${
                recipe.active
                  ? "bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white border-white/10"
                  : "bg-gray-300 text-gray-600 border-gray-400 opacity-70"
              }`}
            >

              {/* INFO */}
              <div>
                <div className="text-xs mb-1">
                  REC-{recipe.id}
                </div>

                <h2 className="text-lg font-semibold mb-3 leading-tight">
                  {recipe.name}
                </h2>

                <div className="flex justify-between text-sm">
                  <span>Porciones</span>
                  <span className="text-right font-semibold">
                    {recipe.portions}
                  </span>
                </div>
              </div>

              {/* ACCIONES */}
              <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center">

                {/* EDITAR */}
                <span className="text-blue-400 text-sm">
                  Editar →
                </span>

                {/* 🔥 BOTÓN ACTIVO / INACTIVO */}
                <button
                  onClick={(e) => toggleActive(e, recipe)}
                  
                  className={`text-xs px-3 py-1 rounded font-semibold ${
                    recipe.active
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "bg-green-500 hover:bg-green-600 text-white"
                  }`}
                >
                  {recipe.active ? "Inactivar" : "Activar"}
                </button>

              </div>
            </div>
          ))}

        </div>
      )}
    </DashboardLayout>
  );
}