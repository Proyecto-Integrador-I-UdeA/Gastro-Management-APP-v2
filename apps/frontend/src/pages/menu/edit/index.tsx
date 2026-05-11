"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { apiFetch } from "@/lib/api";

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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {menuItems.map((item) => (
          <div
            key={item.id}
            onClick={() => router.push(`/menu/edit/${item.id}`)}
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
              <div className="text-xs mb-1">PL-{item.id}</div>

              <h2 className="text-lg font-semibold mb-2">
                {item.name}
              </h2>

              {!item.active && (
                <div className="text-xs text-red-400 font-semibold">
                  ⚠️ Inactivo
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-white/10">
              <span className="text-blue-400 text-sm">
                Editar →
              </span>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}