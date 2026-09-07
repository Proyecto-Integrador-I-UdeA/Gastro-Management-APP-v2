"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import MenuCategoryManager from "@/components/menu/MenuCategoryManager";
import MenuItemThumbnail from "@/components/menu/MenuItemThumbnail";
import { apiFetch } from "@/lib/api";
import { getUserPermissions } from "@/utils/permissions";

export default function MenuListPage() {
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [canManage, setCanManage] = useState(false);


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
    setCanManage(getUserPermissions().includes("menu.manage"));
    void fetchMenu();
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

      <MenuCategoryManager canManage={canManage} />

      <div className="grid grid-cols-1 justify-items-start gap-4 2xl:grid-cols-2">
        {menuItems.map((item) => (
          <div
            key={item.id}
            className={`flex w-full max-w-[860px] flex-col gap-4 rounded-2xl border p-4 shadow-lg
            transition-all duration-300 sm:flex-row
            hover:-translate-y-0.5 hover:shadow-xl
            ${
              item.active
                ? "bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white border-white/10"
                : "bg-gray-300 text-gray-600 border-gray-400 opacity-70"
            }`}
          >
            <MenuItemThumbnail itemName={item.name} image={item.image} size="admin" />

            <div className="min-w-0 flex-1">
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

                <p className="mb-3 text-sm font-medium text-blue-200">
                  Categoría: {item.category?.name || "Sin categoría"}
                </p>

                <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-white/10 px-2.5 py-1">
                    {item.kind === "ADDITION" ? "Adición" : "Plato / producto"}
                  </span>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-emerald-200">
                    Activo
                  </span>
                  <span className={`rounded-full px-2.5 py-1 ${
                    item.available === false
                      ? "bg-amber-500/20 text-amber-200"
                      : "bg-emerald-500/20 text-emerald-200"
                  }`}>
                    {item.available === false ? "Agotado" : "Disponible"}
                  </span>
                </div>

                {item.includedItemsText && (
                  <p className="mb-3 text-sm text-slate-200">
                    {item.includedItemsText}
                  </p>
                )}

                {/* NUEVO INSIGHT */}
                <p className="mb-3 text-sm font-semibold italic leading-relaxed text-amber-200 drop-shadow-sm">
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

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => router.push(`/menu/edit/${item.id}`)}
                      className="rounded bg-blue-500 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-600"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={(e) => toggleActive(e, item)}
                      className={`text-xs px-3 py-1 rounded font-semibold ${
                        item.active
                          ? "bg-red-500 hover:bg-red-600 text-white"
                          : "bg-green-500 hover:bg-green-600 text-white"
                      }`}
                    >
                      {item.active ? "Inactivar" : "Activar"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
