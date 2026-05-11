"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import Button from "@/components/Button";
import { apiFetch } from "@/lib/api";

export default function RecipesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecipes = async () => {
    try {
      const data = await apiFetch("/recipes");

      const list = Array.isArray(data)
        ? data
        : data.recipes || data.data || [];
       setRecipes(list.filter((r: any) => r.active === true));

      setRecipes(list);
    } catch (error) {
      console.error("Error cargando recetas", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token || token === "null") {
      router.push("/login");
      return;
    }

    fetchRecipes();
  }, []);

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">
        Recetas
      </h1>

      <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-800">
            Gestión de recetas
          </h3>

          <Button onClick={() => router.push("/recipes/create")}>
            + Nueva receta
          </Button>
        </div>

        {/* LOADING */}
        {loading ? (
          <div className="text-center py-10">Cargando recetas…</div>
        ) : recipes.length === 0 ? (
          <div className="text-center py-10">
            ⚠️ No hay recetas o la API no respondió correctamente
          </div>
        ) : (

          /* 🔥 GRID DE CARDS */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

            {recipes.map((recipe) => (
              <div
                key={recipe.id}
                className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-5 shadow-xl
                hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between"
              >

                {/* INFO */}
                <div>
                  <div className="text-xs text-gray-400 mb-1">
                    REC-{recipe.id}
                  </div>

                  <h2 className="text-lg font-semibold mb-2">
                    {recipe.name}
                  </h2>

                  <div className="flex justify-between text-sm text-gray-300">
                    <span>Porciones</span>
                    <span className="text-right font-semibold">
                      {recipe.portions}
                    </span>
                  </div>
                </div>

                {/* ACCIONES */}
                <div className="flex justify-between mt-6 pt-4 border-t border-white/10">

                  <button
                    onClick={() => router.push(`/recipes/${recipe.id}`)}
                    className="text-blue-400 hover:underline text-sm"
                  >
                    Ver / Editar
                  </button>

                  <button
                    onClick={() => router.push(`/recipes/${recipe.id}`)}
                    className="text-purple-400 hover:underline text-sm"
                  >
                    Procesos
                  </button>

                </div>

              </div>
            ))}

          </div>
        )}
      </div>
    </DashboardLayout>
  );
}