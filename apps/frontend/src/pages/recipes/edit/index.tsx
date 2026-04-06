"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { apiFetch } from "@/lib/api"; // 🔥 IMPORTANTE

export default function EditRecipesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<any[]>([]);

  const fetchRecipes = async () => {
    try {
      const data = await apiFetch("/recipes");

      const list = Array.isArray(data)
        ? data
        : data.recipes || data.data || [];

      setRecipes(list);

    } catch (error) {
      console.error("Error cargando recetas:", error);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6">
        Editar recetas
      </h1>

      <div className="space-y-3">
        {recipes.map((recipe) => (
          <div
            key={recipe.id}
            onClick={() => router.push(`/recipes/${recipe.id}`)}
            className="p-4 border rounded cursor-pointer hover:bg-gray-100"
          >
            {recipe.name}
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}