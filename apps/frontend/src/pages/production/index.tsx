"use client";

import { useRouter } from "next/router";
import DashboardLayout from "@/components/layouts/DashboardLayout";

export default function ProductionModule() {
  const router = useRouter();

  const cards = [
    {
      title: "Crear receta",
      description: "Registra un nuevo plato",
      path: "/recipes/create",
    },
    {
      title: "Ver recetas",
      description: "Consulta tus recetas",
      path: "/recipes/processes",
    },
    {
  title: "Editar receta",
  description: "Modifica ingredientes y procesos",
  path: "/recipes/edit"
},
    {
  title: "Crear Plato del Menú",
  description: "Crea tus Platos del menú como saldran a la mesa",
  path: "/menu/create"
},
    {
  title: "Menú",
  description: "Aca puedes ver todo tu menu completo ",
  path: "/menu"
},
    {
  title: "Editar Platos del Menú",
  description: "Modifica tus platos del menú",
  path: "/menu/edit"
},


  ];

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-6">
        Módulo de Producción
      </h1>

      <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
        
        <p className="text-gray-700 mb-6">
          Gestiona la estandarización de tus recetas y procesos productivos
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {cards.map((card) => (
            <button
              key={card.path}
              type="button"
              onClick={() => router.push(card.path)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(card.path);
                }
              }}
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
            </button>
          ))}
        </div>

      </div>
    </DashboardLayout>
  );
}
