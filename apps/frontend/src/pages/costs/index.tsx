"use client";

import { useRouter } from "next/router";
import DashboardLayout from "@/components/layouts/DashboardLayout";

export default function CostsModule() {
  const router = useRouter();

  const leftCards = [
    {
      title: "Costos Operativos",
      description:
        "Gestiona arriendo, servicios, nómina y otros costos indirectos",
      path: "/costs/others",
    },
    {
      title: "Costos Variables",
      description:
        "Empaques, delivery, comisiones, desperdicios y costos operativos variables",
      path: "/costs/others",
    },
    {
      title: "Costos por Categoría",
      description:
        "Organiza y controla los gastos del negocio por tipo de costo",
      path: "/costs/others",
    },
  ];

  const rightCards = [
    {
      title: "Cálculo de Costo Por Receta y por Plato",
      description:
        "Calcula el costo real de producción integrando insumos y costos indirectos",
      path: "/costs/total",
    },
    {
      title: "Cálculo de Precio de Venta",
      description:
        "Define precios de venta basados en costos y margen de rentabilidad",
      path: "/costs/price",
    },
    {
      title: "Rentabilidad",
      description:
        "Analiza utilidad, margen bruto y desempeño financiero por plato",
      path: "/costs/price",
    },
  ];

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">
        Módulo de Costos
      </h1>

      <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        <p className="text-gray-800 text-xl mb-6">
          Gestiona costos operativos, costeo de platos y precios de venta
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-4 shadow-xl">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              CONFIGURACIÓN DE COSTOS
            </h2>

            <p className="text-gray-700 mb-4">
              Administra costos fijos, variables y estructura operativa del negocio
            </p>

            <div className="space-y-4">
              {leftCards.map((card, index) => (
                <div
                  key={index}
                  onClick={() => router.push(card.path)}
                  className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-5 shadow-xl hover:scale-[1.02] hover:shadow-2xl transition-all duration-300 cursor-pointer"
                >
                  <h3 className="text-xl font-semibold mb-2">
                    {card.title}
                  </h3>

                  <p className="text-gray-300 text-sm">
                    {card.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-4 shadow-xl">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              ANÁLISIS Y CÁLCULOS
            </h2>

            <p className="text-gray-700 mb-4">
              Evalúa costos reales, define precios y mide rentabilidad
            </p>

            <div className="space-y-4">
              {rightCards.map((card, index) => (
                <div
                  key={index}
                  onClick={() => router.push(card.path)}
                  className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-5 shadow-xl hover:scale-[1.02] hover:shadow-2xl transition-all duration-300 cursor-pointer"
                >
                  <h3 className="text-xl font-semibold mb-2">
                    {card.title}
                  </h3>

                  <p className="text-gray-300 text-sm">
                    {card.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}