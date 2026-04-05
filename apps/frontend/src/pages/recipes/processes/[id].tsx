"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/layouts/DashboardLayout";

export default function ProcessDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [recipe, setRecipe] = useState<any>(null);

  const fetchRecipe = async () => {
    if (!id) return;

    const res = await fetch(`http://localhost:3001/recipes/${id}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const data = await res.json();
    setRecipe(data);
  };

  useEffect(() => {
    if (id) fetchRecipe();
  }, [id]);

  if (!recipe) return <div>Cargando...</div>;

  return (
    <DashboardLayout>

      <h1 className="text-2xl font-bold mb-6">
        {recipe.name} ({recipe.portions} porciones)
      </h1>

      <div className="grid grid-cols-3 gap-6">

        {/* 🔹 INGREDIENTES */}
        <div className="p-4 border rounded">
          <h2 className="font-semibold mb-3">Ingredientes</h2>

          {recipe.items.map((item: any) => (
            <div key={item.id}>
              {item.product?.name} - {item.quantity} {item.product?.unitOfMeasure}
            </div>
          ))}
        </div>

        {/* 🔹 PROCESOS */}
        <div className="p-4 border rounded">
          <h2 className="font-semibold mb-3">Proceso</h2>

          {recipe.processes.map((p: any, index: number) => (
            <div key={index} className="mb-3">
              <div className="font-semibold">
                {index + 1}. {p.name} ({p.duration} min)
              </div>
              <div className="text-gray-600">
                {p.stepDescription}
              </div>
            </div>
          ))}
        </div>

      </div>

    </DashboardLayout>
  );
}