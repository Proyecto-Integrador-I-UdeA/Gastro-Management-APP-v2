"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { apiFetch } from "@/lib/api";

export default function EditMenuListPage() {
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<any[]>([]);

  const fetchMenu = async () => {
    try {
      const data = await apiFetch("/menu-items");
      setMenuItems(data); // 👈 aquí NO filtramos activos
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-bold mb-6">
        Editar Platos del Menú
      </h1>

      <div className="space-y-3">
        {menuItems.map((item) => (
          <div
            key={item.id}
            onClick={() => router.push(`/menu/edit/${item.id}`)}
            className="p-4 border rounded cursor-pointer hover:bg-gray-100"
          >
            {item.name} {!item.active && "(Inactivo)"}
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}