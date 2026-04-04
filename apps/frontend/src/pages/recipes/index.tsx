"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import Button from "@/components/Button";

export default function RecipesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecipes = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token || token === "null") {
        console.error("❌ Token inválido o no existe");
        setLoading(false);
        return;
      }

      const res = await fetch("http://localhost:3001/recipes", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const text = await res.text();
      console.log("RECIPES RAW RESPONSE:", text);

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.error("❌ Respuesta no es JSON");
        setLoading(false);
        return;
      }

      const list = Array.isArray(data)
        ? data
        : data.recipes || data.data || [];

      setRecipes(list);

    } catch (error) {
      console.error("Error cargando recetas", error);
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
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">

              <thead className="text-left border-b">
                <tr>
                  <th>Código</th>
                  <th className="py-2">Nombre</th>
                  <th>Porciones</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {recipes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-6">
                      ⚠️ No hay recetas o la API no respondió correctamente
                    </td>
                  </tr>
                ) : (
                  recipes.map((recipe) => (
                    <tr key={recipe.id} className="hover:bg-gray-200/20">
                      <td>REC-{recipe.id}</td>
                      <td className="py-2 font-semibold">{recipe.name}</td>
                      <td>{recipe.portions}</td>

                      <td className="space-x-4">

                        <button
                          onClick={() => router.push(`/recipes/${recipe.id}`)}
                          className="text-blue-600 hover:underline"
                        >
                          Ver / Editar
                        </button>

                        <button
                          onClick={() => router.push(`/recipes/${recipe.id}`)}
                          className="text-purple-600 hover:underline"
                        >
                          Procesos
                        </button>

                      </td>
                    </tr>
                  ))
                )}
              </tbody>

            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}