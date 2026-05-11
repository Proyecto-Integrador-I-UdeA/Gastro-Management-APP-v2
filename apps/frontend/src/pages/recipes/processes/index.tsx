"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { apiFetch } from "@/lib/api";

export default function ProcessesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecipes = async () => {
    try {
      const data = await apiFetch("/recipes");

      const list = Array.isArray(data)
        ? data
        : data.recipes || data.data || [];

      setRecipes(list.filter((r: any) => r.active));
    } catch (error) {
      console.error("Error cargando recetas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">
        Componentes / Procesos
      </h1>

      {loading ? (
        <div className="text-center py-10">Cargando...</div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-10">
          ⚠️ No hay recetas registradas
        </div>
      ) : (

        /* 🔥 GRID PROFESIONAL */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              onClick={() => router.push(`/recipes/processes/${recipe.id}`)}
              className="cursor-pointer bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-5 shadow-xl
              hover:scale-[1.03] hover:shadow-2xl transition-all duration-300 border border-white/10 flex flex-col justify-between"
            >

              {/* INFO */}
              <div>
                <div className="text-xs text-gray-400 mb-1">
                  REC-{recipe.id}
                </div>

                <h2 className="text-lg font-semibold mb-3 leading-tight">
                  {recipe.name}
                </h2>

                <div className="flex justify-between text-sm text-gray-300">
                  <span>Porciones</span>
                  <span className="text-right font-semibold">
                    {recipe.portions}
                  </span>
                </div>
              </div>

              {/* ACCIÓN */}
              <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
                <span className="text-blue-400 text-sm hover:underline">
                  Ver procesos →
                </span>
              </div>

            </div>
          ))}

        </div>
      )}
    </DashboardLayout>
  );
}