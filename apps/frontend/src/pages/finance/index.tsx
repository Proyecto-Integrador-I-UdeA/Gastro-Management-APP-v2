"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { getUserPermissions } from "@/utils/permissions";

type FinanceModule = {
  title: string;
  description: string;
  path: string;
};

const moduleGroups: Array<{
  title: string;
  description: string;
  modules: FinanceModule[];
}> = [
  {
    title: "GESTIÓN BASE",
    description: "Ingresos, egresos y rentabilidad quedan fuera de esta fase.",
    modules: [],
  },
  {
    title: "GASTOS Y NÓMINA",
    description: "Gastos estructurales y costo laboral del restaurante.",
    modules: [
      {
        title: "Gastos",
        description: "Gastos fijos y costos indirectos variables del periodo.",
        path: "/finance/expenses",
      },
      {
        title: "Nómina",
        description: "Salarios, prestaciones y costo laboral por área.",
        path: "/finance/payroll",
      },
    ],
  },
  {
    title: "ANÁLISIS FINANCIERO",
    description: "Estado de resultados e indicadores quedan fuera de esta fase.",
    modules: [],
  },
];

export default function FinanceHomePage() {
  const router = useRouter();
  const [accessAllowed, setAccessAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const currentPermissions = getUserPermissions();
    setAccessAllowed(currentPermissions.includes("accounting.read"));
  }, []);

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#001F3F]">
            Módulo de Gestión Financiera
          </h1>
          <p className="mt-2 text-gray-600">
            Controla gastos y nómina. Los demás submódulos se habilitan en fases posteriores.
          </p>
        </div>

        {accessAllowed === null ? (
          <div className="rounded-xl bg-white p-6 text-gray-600 shadow-sm">
            Cargando módulo...
          </div>
        ) : !accessAllowed ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
            No tienes permiso para acceder a gestión financiera.
          </div>
        ) : (
          <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
            {moduleGroups.map((group) => (
              <section
                key={group.title}
                className="flex h-full flex-col rounded-2xl border border-gray-200 bg-gray-100 p-5 shadow-sm"
              >
                <div className="min-h-[76px]">
                  <h2 className="text-xl font-bold text-gray-900">{group.title}</h2>
                  <p className="mt-1 text-sm text-gray-600">{group.description}</p>
                </div>

                <div className="grid flex-1 auto-rows-fr gap-4">
                  {group.modules.length === 0 ? (
                    <div className="flex min-h-[168px] items-center rounded-2xl border border-dashed border-gray-300 bg-white/70 px-5 text-sm text-gray-500">
                      Sin submódulos en esta fase.
                    </div>
                  ) : (
                    group.modules.map((module) => (
                      <button
                        key={module.path}
                        type="button"
                        onClick={() => void router.push(module.path)}
                        className="flex min-h-[168px] w-full cursor-pointer flex-col rounded-2xl bg-gradient-to-br from-[#0f274a] to-[#1b3155] p-5 text-left text-white shadow-md transition hover:-translate-y-1 hover:shadow-xl"
                      >
                        <span className="block text-lg font-semibold">{module.title}</span>
                        <span className="mt-2 block flex-1 text-sm text-slate-200">
                          {module.description}
                        </span>
                        <span className="mt-4 self-start rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-medium text-emerald-100">
                          Disponible
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
