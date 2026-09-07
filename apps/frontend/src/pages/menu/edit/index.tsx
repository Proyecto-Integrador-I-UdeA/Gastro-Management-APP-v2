"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { apiFetch } from "@/lib/api";
import MenuItemThumbnail from "@/components/menu/MenuItemThumbnail";

export default function EditMenuListPage() {
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<any[]>([]);

  const fetchMenu = async () => {
    try {
      const data = await apiFetch("/menu-items");
      setMenuItems(data); // 🔥 mostramos todos (activos e inactivos)
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">
        Editar Platos del Menú
      </h1>

      <div className="grid grid-cols-1 justify-items-start gap-4 2xl:grid-cols-2">
        {menuItems.map((item) => (
          <div
            key={item.id}
            onClick={() => router.push(`/menu/edit/${item.id}`)}
            className={`flex w-full max-w-[860px] cursor-pointer flex-col gap-4 rounded-2xl border p-4 shadow-lg
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
                <div className="text-xs mb-1">PL-{item.id}</div>

                <h2 className="text-lg font-semibold mb-2">
                  {item.name}
                </h2>

                {item.description && (
                  <p className="mb-3 text-sm italic text-gray-300">
                    {item.description}
                  </p>
                )}

                <p className="mb-3 text-sm text-blue-200">
                  Categoría: {item.category?.name || "Sin categoría"}
                </p>

                <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-white/10 px-2.5 py-1">
                    {item.kind === "ADDITION" ? "Adición" : "Plato / producto"}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 ${
                    item.active
                      ? "bg-emerald-500/20 text-emerald-200"
                      : "bg-slate-500/20 text-slate-700"
                  }`}>
                    {item.active ? "Activo" : "Inactivo"}
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

                {!item.active && (
                  <div className="text-xs text-red-400 font-semibold">
                    ⚠️ Inactivo
                  </div>
                )}
              </div>

              <div className="mt-3 border-t border-white/10 pt-3">
                <span className="text-blue-400 text-sm">
                  Editar →
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
