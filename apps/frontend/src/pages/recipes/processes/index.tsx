"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/layouts/DashboardLayout";

export default function ProcessesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<any[]>([]);

  const fetchRecipes = async () => {
    const res = await fetch("http://localhost:3001/recipes", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const data = await res.json();
    setRecipes(data);
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6">
        Procesos de producción
      </h1>

      <div className="space-y-3">
        {recipes.map((recipe) => (
          <div
            key={recipe.id}
            onClick={() => router.push(`/recipes/processes/${recipe.id}`)}
            className="p-4 border rounded cursor-pointer hover:bg-gray-100"
          >
            {recipe.name}
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}