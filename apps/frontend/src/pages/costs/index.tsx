"use client";

import { useRouter } from "next/router";
import DashboardLayout from "@/components/layouts/DashboardLayout";

export default function CostsModule() {
  const router = useRouter();

  const cards = [
    {
      title: "Otros costos",
      description: "Gestiona costos fijos, variables y nómina",
      path: "/costs/others",
    },
    {
      title: "Cálculo de costo total",
      description: "Calcula el costo real de producción",
      path: "/costs/total",
    },
    {
      title: "Cálculo de precio de venta",
      description: "Define precios basados en costos",
      path: "/costs/price",
    },
  ];

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">
        Módulo de Costos
      </h1>

      <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        
        <p className="text-gray-700 mb-6">
          Gestiona los costos operativos y define precios de venta
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">

          {cards.map((card, index) => (
            <div
              key={index}
              onClick={() => router.push(card.path)}
              className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
              shadow-[0_4px_20px_rgba(30,64,175,0.25)]
              hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
              transition-all duration-300 cursor-pointer flex flex-col"
            >
              <h2 className="text-lg font-semibold text-gray-800 mb-2">
                {card.title}
              </h2>
              <p className="text-sm text-gray-600">
                {card.description}
              </p>
            </div>
          ))}

        </div>
      </div>
    </DashboardLayout>
  );
}