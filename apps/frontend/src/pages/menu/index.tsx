"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { apiFetch } from "@/lib/api";

export default function MenuListPage() {
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<any[]>([]);

  const fetchMenu = async () => {
    try {
      const data = await apiFetch("/menu-items");

      // 🔥 SOLO ACTIVOS
      setMenuItems(data.filter((item: any) => item.active));

    } catch (error) {
      console.error("Error cargando menú:", error);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  // 🔥 TOGGLE ACTIVO / INACTIVO
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

      {/* 🔥 GRID PROFESIONAL */}
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

            {/* INFO */}
            <div>
              <div className="text-xs mb-1">
                PL-{item.id}
              </div>

              <h2 className="text-lg font-semibold mb-2">
                {item.name}
              </h2>

              {/* DESCRIPCIÓN */}
              {item.description && (
                <p className="text-sm text-gray-300 italic mb-3">
                  Acompañado con: {item.description}
                </p>
              )}

              {/* OPCIONES */}
              <div className="text-sm space-y-1">
                {item.hasDrink && (
                  <p>🍹 Incluye bebida</p>
                )}

                {item.hasDessert && (
                  <p>🍰 Incluye postre</p>
                )}
              </div>
            </div>

            {/* ACCIONES */}
            <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center">

              {/* 🔥 ACTIVAR / INACTIVAR */}
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