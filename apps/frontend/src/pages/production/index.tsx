"use client";

import { useRouter } from "next/router";
import DashboardLayout from "@/components/layouts/DashboardLayout";

export default function ProductionModule() {
  const router = useRouter();

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-1">
        Módulo de Producción
      </h1>
          <div className="flex-1 overflow-hidden">

      <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        
        <p className="text-black-500 mb-1">
          Gestiona la estandarización de tus recetas y procesos productivos
        </p>

        {/* 🔥 GRID PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* 🍳 RECETAS */}
          <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">

            <h2 className="text-xl font-semibold text-gray-800 mb-1">
              COMPONENTES PARA PLATOS
            </h2>

            <p className="text-sm text-black-600 mb-1">
              Gestiona Ingredientes, Procesos y Visualización de Recetas Estandarizadas
            </p>

            <div className="space-y-3">

              {/* CREAR */}
              <button
                onClick={() => router.push("/recipes/create")}
                className="w-full bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-xl p-4 text-left
                shadow-[0_8px_25px_rgba(0,0,0,0.35)]
                hover:scale-[1.02] transition"
              >
                <h3 className="font-semibold">Genera tu componente</h3>
                <p className="text-sm text-gray-300">
                  Registra Aqui una Nueva Receta
                </p>
              </button>

              {/* VER */}
              <button
                onClick={() => router.push("/recipes/processes")}
                className="w-full bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-xl p-4 text-left
                shadow-[0_8px_25px_rgba(0,0,0,0.35)]
                hover:scale-[1.02] transition"
              >
                <h3 className="font-semibold">Listado de Componentes</h3>
                <p className="text-sm text-gray-300">
                  Consulta tus Recetas Registradas
                </p>
              </button>

              {/* EDITAR */}
              <button
                onClick={() => router.push("/recipes/edit")}
                className="w-full bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-xl p-4 text-left
                shadow-[0_8px_25px_rgba(0,0,0,0.35)]
                hover:scale-[1.02] transition"
              >
                <h3 className="font-semibold">Cambios</h3>
                <p className="text-sm text-gray-300">
                
                  Modifica Ingredientes y Procesos
                </p>
              </button>

            </div>
          </div>

          {/* 🍽️ PLATOS DEL MENÚ */}
          <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">

            <h2 className="text-xl font-semibold text-gray-800 mb-1">
              PLATOS DEL MENÚ

            </h2>

            <p className="text-sm text-black-600 mb-1">
              Configura Aqui los Ingredientes de los  Platos Finales que se Ofreceran  al Cliente
            </p>

            <div className="space-y-3">

              {/* CREAR */}
              <button
                onClick={() => router.push("/menu/create")}
                className="w-full bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-xl p-4 text-left
                shadow-[0_8px_25px_rgba(0,0,0,0.35)]
                hover:scale-[1.02] transition"
              >
                <h3 className="font-semibold">Generar Nuevo PLato</h3>
                <p className="text-sm text-gray-300">
                  Crea Platos Innovadores para tu  Menú
                </p>
              </button>

              {/* VER */}
              <button
                onClick={() => router.push("/menu")}
                className="w-full bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-xl p-4 text-left
                shadow-[0_8px_25px_rgba(0,0,0,0.35)]
                hover:scale-[1.02] transition"
              >
                <h3 className="font-semibold">Menú</h3>
                <p className="text-sm text-gray-300">
                  Visualiza Todos los Platos Creados para tu Menú
                </p>
              </button>

              {/* EDITAR */}
              <button
                onClick={() => router.push("/menu/edit")}
                className="w-full bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-xl p-4 text-left
                shadow-[0_8px_25px_rgba(0,0,0,0.35)]
                hover:scale-[1.02] transition"
              >
                <h3 className="font-semibold">Cambiar Componentes del Plato</h3>
                <p className="text-sm text-gray-300">
                  Modifica Platos Existente
                </p>
              </button>

            </div>
          </div>

        </div>
        </div>

      </div>
    </DashboardLayout>
  );
}