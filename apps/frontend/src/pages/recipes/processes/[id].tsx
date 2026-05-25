"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { apiFetch } from "@/lib/api";

export default function ProcessDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [recipe, setRecipe] = useState<any>(null);

  const fetchRecipe = async () => {
    if (!id) return;

    const res = await apiFetch(`/recipes/${id}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    setRecipe(res);
  };

  useEffect(() => {
    if (id) fetchRecipe();
  }, [id]);

  if (!recipe) return <div className="p-6">Cargando...</div>;

  return (
    <DashboardLayout>

      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#001F3F]">
          {recipe.name}
        </h1>
        <p className="text-gray-600">
          {recipe.portions} porciones
        </p>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 🔹 INGREDIENTES */}
        <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-5 shadow-xl">

          <h2 className="text-lg font-semibold mb-4">
            Ingredientes
          </h2>

          <div className="space-y-3 text-sm">
      
      {recipe.items.map((item: any) => {
  const isSubRecipe = !!item.subRecipeId;

  return (
    <div
      key={item.id}
      className="flex justify-between border-b border-white/10 pb-2"
    >
      <span>
        {isSubRecipe
          ? item.subRecipe?.name
          : item.product?.name}
      </span>

      <span className="text-right font-semibold">
        {item.quantity}{" "}
        {isSubRecipe
          ? "porciones"
          : item.product?.unitOfMeasure}
      </span>
    </div>
  );
})}
           
      
          </div>
        </div>

        {/* 🔥 PROCESOS (MÁS IMPORTANTE) */}
        <div className="lg:col-span-2 bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-6 shadow-xl">

          <h2 className="text-lg font-semibold mb-4">
            Proceso de preparación
          </h2>

          <div className="space-y-4">

            {recipe.processes.map((p: any, index: number) => (
              <div
                key={index}
                className="p-4 rounded-xl bg-white/5 border border-white/10"
              >

                {/* TÍTULO */}
                <div className="flex justify-between mb-2">
                  <div className="font-semibold">
                    {index + 1}. {p.name}
                  </div>

                  <div className="text-sm text-blue-300 font-semibold">
                    {p.duration} min
                  </div>
                </div>

                {/* DESCRIPCIÓN */}
                <div className="text-sm text-gray-300">
                  {p.stepDescription}
                </div>

              </div>
            ))}

          </div>
        </div>

      </div>

    </DashboardLayout>
  );
}