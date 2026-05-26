"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { apiFetch } from "@/lib/api";

export default function MenuListPage() {
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<any[]>([]);


  const getNutritionInsight = (item: any) => {
  const calories = Number(item.caloriesPerPortion || 0);
  const protein = Number(item.proteinPerPortion || 0);
  const sodium = Number(item.sodiumPerPortion || 0);
  const fat = Number(item.fatPerPortion || 0);
  const score = Number(item.nutritionScore || 0);

  if (calories >= 900 || fat >= 35) {
    return "😄 Un gustico contundente… porque disfrutar también cuenta.";
  }

  if (calories >= 650) {
    return "🔥 Plato energético para jornadas exigentes.";
  }

  if (protein >= 30) {
    return "💪 Buena fuente de proteína para mantener energía.";
  }

  if (sodium >= 1500) {
    return "🧂 Sabor intenso para quienes disfrutan platos con carácter.";
  }

  if (calories <= 500) {
    return "🥗 Opción ligera para un almuerzo balanceado.";
  }

  if (score >= 85) {
    return "✨ Una opción equilibrada para el día a día.";
  }

  return "🍽️ Una opción pensada para disfrutar.";
};

  const fetchMenu = async () => {
    try {
      const data = await apiFetch("/menu-items");

      setMenuItems(data.filter((item: any) => item.active));
    } catch (error) {
      console.error("Error cargando menú:", error);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  const toggleActive = async (e: any, item: any) => {
    e.stopPropagation();

    try {
      await apiFetch(`/menu-items/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({
          active: !item.active,
        }),
      });

      setMenuItems((prev) =>
        prev.map((m) =>
          m.id === item.id ? { ...m, active: !item.active } : m
        )
      );
    } catch (error) {
      console.error("Error actualizando estado:", error);
    }
  };

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">
        Menú del Restaurante
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {menuItems.map((item) => (
          <div
            key={item.id}
            className={`cursor-pointer rounded-2xl p-5 shadow-xl
            transition-all duration-300 flex flex-col justify-between border
            hover:scale-[1.03] hover:shadow-2xl
            ${
              item.active
                ? "bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white border-white/10"
                : "bg-gray-300 text-gray-600 border-gray-400 opacity-70"
            }`}
          >
            <div>
              <div className="text-xs mb-1">
                PL-{item.id}
              </div>

              <h2 className="text-lg font-semibold mb-2">
                {item.name}
              </h2>

              {item.description && (
                <p className="text-sm text-gray-300 italic mb-3">
                   {item.description}
                </p>
              )}

              {/* NUEVO INSIGHT */}
              <p className="text-lg italic font-semibold text-amber-200 mb-5 leading-relaxed tracking-wide drop-shadow-sm">
               {getNutritionInsight(item)}
              </p>
              
              

              <div className="text-sm space-y-1">
                {item.hasDrink && (
                  <p>🍹 Incluye bebida</p>
                )}

                {item.hasDessert && (
                  <p>🍰 Incluye postre</p>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center">
              <button
                onClick={(e) => toggleActive(e, item)}
                className={`text-xs px-3 py-1 rounded font-semibold ${
                  item.active
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-green-500 hover:bg-green-600 text-white"
                }`}
              >
                {item.active ? "Inactivar" : "Activar"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}