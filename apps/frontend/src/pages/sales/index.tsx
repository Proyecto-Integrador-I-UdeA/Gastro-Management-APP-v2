"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { getUserPermissions } from "@/utils/permissions";

type SalesModule = {
  title: string;
  description: string;
  path: string;
  available: boolean;
};

const moduleGroups: Array<{
  title: string;
  description: string;
  modules: SalesModule[];
}> = [
  {
    title: "OPERACIÓN",
    description: "Atiende mesas y preparación en tiempo real.",
    modules: [
      {
        title: "Mesas y pedidos",
        description: "Abre mesas, registra pedidos y consulta su estado.",
        path: "/sales/orders",
        available: false,
      },
      {
        title: "Cocina",
        description: "Monitorea preparación, tiempos y pedidos listos.",
        path: "/sales/kitchen",
        available: false,
      },
    ],
  },
  {
    title: "GESTIÓN COMERCIAL",
    description: "Consulta la oferta disponible para la venta.",
    modules: [
      {
        title: "Menú y precios",
        description: "Consulta platos disponibles y sus precios vigentes.",
        path: "/sales/menu",
        available: true,
      },
      {
        title: "Caja",
        description: "Cobra pedidos entregados y ciérralos como ventas.",
        path: "/sales/cash",
        available: false,
      },
    ],
  },
  {
    title: "RELACIÓN Y SEGUIMIENTO",
    description: "Organiza reservas y consulta la actividad comercial.",
    modules: [
      {
        title: "Reservas y eventos",
        description: "Agenda reservas, mesas y eventos privados.",
        path: "/sales/reservations",
        available: false,
      },
      {
        title: "Ventas",
        description: "Consulta ventas, documentos y canales.",
        path: "/sales/operations",
        available: false,
      },
    ],
  },
];

export default function SalesDashboardPage() {
  const router = useRouter();
  const [accessAllowed, setAccessAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    setAccessAllowed(getUserPermissions().includes("sales.read"));
  }, []);

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#001F3F]">Módulo de Ventas</h1>
          <p className="mt-2 text-gray-600">
            Gestiona la operación comercial del restaurante desde la mesa hasta el cobro.
          </p>
        </div>

        {accessAllowed === null ? (
          <div className="rounded-xl bg-white p-6 text-gray-600 shadow-sm">
            Cargando módulo...
          </div>
        ) : !accessAllowed ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
            No tienes permiso para acceder al módulo de ventas.
          </div>
        ) : (
          <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
            {moduleGroups.map(group => (
              <section
                key={group.title}
                className="flex h-full flex-col rounded-2xl border border-gray-200 bg-gray-100 p-5 shadow-sm"
              >
                <div className="min-h-[76px]">
                  <h2 className="text-xl font-bold text-gray-900">{group.title}</h2>
                  <p className="mt-1 text-sm text-gray-600">{group.description}</p>
                </div>

                <div className="grid flex-1 grid-rows-2 gap-4">
                  {group.modules.map(module => (
                    <button
                      key={module.path}
                      type="button"
                      disabled={!module.available}
                      onClick={() => module.available && void router.push(module.path)}
                      className={`flex min-h-[168px] w-full flex-col rounded-2xl bg-gradient-to-br p-5 text-left text-white shadow-md transition ${
                        module.available
                          ? "cursor-pointer from-[#0f274a] to-[#1b3155] hover:-translate-y-1 hover:shadow-xl"
                          : "cursor-not-allowed from-[#334155] to-[#475569] opacity-75"
                      }`}
                    >
                      <span className="block text-lg font-semibold">{module.title}</span>
                      <span className="mt-2 block flex-1 text-sm text-slate-200">
                        {module.description}
                      </span>
                      <span className={`mt-4 self-start rounded-full px-3 py-1 text-xs font-medium ${
                        module.available
                          ? "bg-emerald-400/20 text-emerald-100"
                          : "bg-white/15 text-slate-100"
                      }`}
                      >
                        {module.available ? "Disponible" : "Próximamente"}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
