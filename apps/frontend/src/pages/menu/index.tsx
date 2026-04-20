"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { apiFetch } from "@/lib/api";

export default function MenuListPage() {
  const [menuItems, setMenuItems] = useState<any[]>([]);

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

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">
        Menú del Restaurante
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {menuItems.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-xl shadow-md p-6 border hover:shadow-lg transition"
          >
            {/* NOMBRE */}
            <h2 className="text-xl font-bold text-[#001F3F] mb-2">
              {item.name}
            </h2>

            {/* DESCRIPCIÓN 
            <p className="text-sm text-gray-600 mb-3">
              {item.description}
            </p>*/}

            {/* COMPONENTES 
            <div className="text-sm text-gray-700 mb-3">
              {item.components.map((c: any, i: number) => (
                <div key={i}>
                  {c.product?.name || c.recipe?.name}
                </div>
              ))}
            </div>*/}

            {/* OPCIONES */}
           {/* SUBTÍTULO */}
<p className="text-sm text-gray-600 italic mb-3">
  {item.description
    ? `Acompañado con: ${item.description}`
    : ""}
</p>

{/* BEBIDA */}
{item.hasDrink && (
  <p className="text-sm text-gray-700">
    🍹 Incluye bebida (gaseosa, guarapo o jugo en agua)
  </p>
)}

{/* POSTRE */}
{item.hasDessert && (
  <p className="text-sm text-gray-700">
    🍰 Incluye postre (dulce de leche o gelatina)
  </p>
)}        
           
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}