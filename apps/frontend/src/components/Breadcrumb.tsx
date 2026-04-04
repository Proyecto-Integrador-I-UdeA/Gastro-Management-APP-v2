"use client";

import { usePathname } from "next/navigation";

export default function Breadcrumb() {
  const pathname = usePathname();

  const segments = pathname.split("/").filter(Boolean);

  const format = (seg: string) => {
    const map: any = {
      dashboard: "Dashboard",
      products: "Productos",
      suppliers: "Proveedores",
      production: "Producción",
      recipes: "Producción",
      costs: "Costos",
      others: "Otros Costos",
      price: "Precio",
    };

    return map[seg] || seg;
  };

  return (
    <div className="text-sm text-gray-500 mb-4">
      {segments.length === 0
        ? "Dashboard"
        : ["Dashboard", ...segments.map(format)].join(" / ")}
    </div>
  );
}