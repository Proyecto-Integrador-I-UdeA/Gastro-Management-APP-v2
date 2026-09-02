"use client";

import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import Button from "@/components/Button";
import { showError, showSuccess } from "@/utils/toast";
import { apiFetch } from "@/lib/api";

export default function CostCategoriesPage() {
  const [month, setMonth] = useState("");

  // CATEGORÍAS
  const [production, setProduction] =
    useState(0);

  const [operation, setOperation] =
    useState(0);

  const [distribution, setDistribution] =
    useState(0);

  const [commercial, setCommercial] =
    useState(0);

  const [administration, setAdministration] =
    useState(0);

  const [costsList, setCostsList] = useState<any[]>([]);

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [showHistory, setShowHistory] =
    useState(false);

  const [activeConfig, setActiveConfig] =
    useState<any | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value || 0);
  };

// SIMULADOR
const analytics = useMemo(() => {
  const total =
    Number(production || 0) +
    Number(operation || 0) +
    Number(distribution || 0) +
    Number(commercial || 0) +
    Number(administration || 0);

  let status = {
    label: "Configura la distribución de categorías",
    color: "text-gray-300",
  };

  if (total === 100) {
    if (production > 50) {
      status = {
        label:
          "🔴 Producción concentra gran parte de los costos",
        color: "text-red-400",
      };
    } else if (operation > 35) {
      status = {
        label:
          "🟡 Los costos operativos tienen un peso elevado",
        color: "text-yellow-400",
      };
    } else if (commercial < 5) {
      status = {
        label:
          "🟡 La inversión comercial es muy baja",
        color: "text-yellow-400",
      };
    } else if (distribution > 20) {
      status = {
        label:
          "🟡 La distribución puede afectar la rentabilidad",
        color: "text-yellow-400",
      };
    } else {
      status = {
        label:
          "🟢 Estructura de costos equilibrada",
        color: "text-green-400",
      };
    }
  } else if (total > 0) {
    status = {
      label: `⚠️ La distribución suma ${total}% (debe ser 100%)`,
      color: "text-yellow-400",
    };
  }

  return {
    total,
    status,
  };
}, [
  production,
  operation,
  distribution,
  commercial,
  administration,
]);

// CONFIGURACIÓN VIGENTE
const activeAnalytics = useMemo(() => {
  if (!activeConfig) return null;

  const total =
    Number(activeConfig.production || 0) +
    Number(activeConfig.operation || 0) +
    Number(activeConfig.distribution || 0) +
    Number(activeConfig.commercial || 0) +
    Number(activeConfig.administration || 0);

  let status = {
    label: "Sin configuración activa",
    color: "text-gray-300",
  };

  if (total === 100) {
    if (activeConfig.production > 50) {
      status = {
        label:
          "🔴 Producción concentra gran parte de los costos",
        color: "text-red-400",
      };
    } else if (activeConfig.operation > 35) {
      status = {
        label:
          "🟡 Los costos operativos tienen un peso elevado",
        color: "text-yellow-400",
      };
    } else if (activeConfig.commercial < 5) {
      status = {
        label:
          "🟡 La inversión comercial es muy baja",
        color: "text-yellow-400",
      };
    } else if (activeConfig.distribution > 20) {
      status = {
        label:
          "🟡 La distribución puede afectar la rentabilidad",
        color: "text-yellow-400",
      };
    } else {
      status = {
        label:
          "🟢 Estructura de costos equilibrada",
        color: "text-green-400",
      };
    }
  }

  return {
    total,
    status,
  };
}, [activeConfig]);

 


// TRAER CATEGORÍAS
const fetchCosts = async () => {
  try {
    const data = await apiFetch("/costs/categories");

    const list = Array.isArray(data)
      ? data
      : data.data || data.costs || [];

    setCostsList(list);

    if (list.length > 0) {
      const sorted = [...list].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );

      setActiveConfig(sorted[0]);
    }
  } catch (error) {
    console.error(
      "Error cargando categorías:",
      error
    );
  }
};

useEffect(() => {
  fetchCosts();
}, []);


// GUARDAR / EDITAR
const handleSave = async () => {
  try {
    const total =
      Number(production || 0) +
      Number(operation || 0) +
      Number(distribution || 0) +
      Number(commercial || 0) +
      Number(administration || 0);

    if (total !== 100) {
      showError(
        "La distribución debe sumar exactamente 100%"
      );
      return;
    }

    const endpoint = editingId
      ? `/costs/categories/${editingId}`
      : "/costs/categories";

    const method = editingId
      ? "PUT"
      : "POST";

    await apiFetch(endpoint, {
      method,

      body: JSON.stringify({
        month,
        production,
        operation,
        distribution,
        commercial,
        administration,
      }),
    });

    showSuccess(
      editingId
        ? "Categorías actualizadas"
        : "Categorías guardadas"
    );

    await fetchCosts();

    setEditingId(null);

    setMonth("");

    setProduction(0);
    setOperation(0);
    setDistribution(0);
    setCommercial(0);
    setAdministration(0);

  } catch (error) {
    console.error(error);

    showError(
      "Error al guardar categorías"
    );
  }
};


// EDITAR
const handleEdit = (cost: any) => {
  setEditingId(cost.id);

  setMonth(cost.month);

  setProduction(
    Number(cost.production || 0)
  );

  setOperation(
    Number(cost.operation || 0)
  );

  setDistribution(
    Number(cost.distribution || 0)
  );

  setCommercial(
    Number(cost.commercial || 0)
  );

  setAdministration(
    Number(cost.administration || 0)
  );
};


// ELIMINAR
const handleDelete = async (
  id: number
) => {
  if (
    !confirm("¿Eliminar este registro?")
  )
    return;

  try {
    await apiFetch(
      `/costs/categories/${id}`,
      {
        method: "DELETE",
      }
    );

    fetchCosts();
  } catch (error) {
    console.error(error);
  }
};

return (
  <DashboardLayout>
    <h1 className="text-3xl font-bold text-[#001F3F] mb-6">
      Costos por Categoria
    </h1>

    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

      {/* FORMULARIO */}
      <div className="lg:col-span-2 bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-xl space-y-6">

        {/* PERIODO */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Periodo contable
          </h2>

          <p className="text-sm text-gray-600 mb-3">
            Selecciona el mes al que corresponden esta Distribucion por Categorias.
          </p>

          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border p-3 rounded-xl w-64"
          />
        </div>
{/* PRODUCCIÓN */}
<div>
  <h2 className="text-xl font-semibold text-gray-800 mb-2">
    Producción (%)
  </h2>

  <p className="text-sm text-gray-600 mb-3">
    Ingredientes, merma y procesos de cocina.
  </p>

  <input
    type="number"
    min="0"
    max="100"
    value={production}
    onChange={(e) =>
      setProduction(Number(e.target.value))
    }
    className="border p-3 rounded-xl w-full text-right"
  />
</div>

{/* OPERACIÓN */}
<div>
  <h2 className="text-xl font-semibold text-gray-800 mb-2">
    Operación (%)
  </h2>

  <p className="text-sm text-gray-600 mb-3">
    Arriendo, servicios públicos, internet y software.
  </p>

  <input
    type="number"
    min="0"
    max="100"
    value={operation}
    onChange={(e) =>
      setOperation(Number(e.target.value))
    }
    className="border p-3 rounded-xl w-full text-right"
  />
</div>

{/* DISTRIBUCIÓN */}
<div>
  <h2 className="text-xl font-semibold text-gray-800 mb-2">
    Distribución (%)
  </h2>

  <p className="text-sm text-gray-600 mb-3">
    Empaques, plataformas y entregas.
  </p>

  <input
    type="number"
    min="0"
    max="100"
    value={distribution}
    onChange={(e) =>
      setDistribution(Number(e.target.value))
    }
    className="border p-3 rounded-xl w-full text-right"
  />
</div>

{/* COMERCIAL */}
<div>
  <h2 className="text-xl font-semibold text-gray-800 mb-2">
    Comercial (%)
  </h2>

  <p className="text-sm text-gray-600 mb-3">
    Marketing, publicidad y promociones.
  </p>

  <input
    type="number"
    min="0"
    max="100"
    value={commercial}
    onChange={(e) =>
      setCommercial(Number(e.target.value))
    }
    className="border p-3 rounded-xl w-full text-right"
  />
</div>

{/* ADMINISTRACIÓN */}
<div>
  <h2 className="text-xl font-semibold text-gray-800 mb-2">
    Administración (%)
  </h2>

  <p className="text-sm text-gray-600 mb-3">
    Contabilidad, licencias, asesorías y gestión administrativa.
  </p>

  <input
    type="number"
    min="0"
    max="100"
    value={administration}
    onChange={(e) =>
      setAdministration(Number(e.target.value))
    }
    className="border p-3 rounded-xl w-full text-right"
  />
</div>
             
      <div className="flex gap-4 pt-2">

  <Button onClick={handleSave}>
    {editingId
      ? "Actualizar costos variables"
      : "Guardar costos variables"}
  </Button>

  <button
    onClick={() => setShowHistory(!showHistory)}
    className="px-4 py-2 rounded-xl border border-gray-400 text-gray-700 hover:bg-gray-200 transition"
  >
    {showHistory
      ? "Ocultar historial"
      : "Ver historial"}
  </button>
</div>
</div>

      {/* PANELES */}
      <div className="space-y-6">

  {/* SIMULADOR */}
<div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-6 shadow-xl space-y-6">

  <h2 className="text-xl font-semibold">
    Distribución actual
  </h2>

  <div className="flex justify-between">
    <span>Total distribuido</span>

    <span className="text-green-400 font-bold">
      {analytics.total}%
    </span>
  </div>

  <div>
    <span
      className={`font-semibold ${analytics.status.color}`}
    >
      {analytics.status.label}
    </span>
  </div>

</div>

  <div>
    <span
      className={`font-semibold ${analytics.status.color}`}
    >
      {analytics.status.label}
    </span>
  </div>

</div>
 {/* CONFIGURACIÓN VIGENTE */}
{activeAnalytics && (
  <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-6 shadow-xl space-y-4">

    <h2 className="text-xl font-semibold">
      Distribución vigente
    </h2>

    <div className="text-sm text-gray-300">
      Periodo: {activeConfig.month}
    </div>

    <div className="flex justify-between">
      <span>Producción</span>
      <span className="font-bold">
        {activeConfig.production}%
      </span>
    </div>

    <div className="flex justify-between">
      <span>Operación</span>
      <span className="font-bold">
        {activeConfig.operation}%
      </span>
    </div>

    <div className="flex justify-between">
      <span>Distribución</span>
      <span className="font-bold">
        {activeConfig.distribution}%
      </span>
    </div>

    <div className="flex justify-between">
      <span>Comercial</span>
      <span className="font-bold">
        {activeConfig.commercial}%
      </span>
    </div>

    <div className="flex justify-between">
      <span>Administración</span>
      <span className="font-bold">
        {activeConfig.administration}%
      </span>
    </div>

    <div className="border-t border-white/10 pt-3">
      <div className="flex justify-between">
        <span>Total</span>

        <span className="text-green-400 font-bold">
          {activeAnalytics.total}%
        </span>
      </div>
    </div>

    <div>
      <span
        className={`font-semibold ${activeAnalytics.status.color}`}
      >
        {activeAnalytics.status.label}
      </span>
    </div>

  </div>
)}   
   </div>
 
{showHistory && (
  <div className="mt-10">
    {costsList.length === 0 ? (
      <div className="bg-gray-400/30 backdrop-blur-md border border-white/20 rounded-2xl p-10 text-center text-gray-700">
        No hay registros de categorías
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

        {costsList.map((c) => {
          const total =
            Number(c.production || 0) +
            Number(c.operation || 0) +
            Number(c.distribution || 0) +
            Number(c.commercial || 0) +
            Number(c.administration || 0);

          return (
            <div
              key={c.id}
              className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-5 shadow-xl min-h-[460px] flex flex-col justify-between"
            >

              <div>

                <div className="text-xs text-gray-400 mb-4">
                  {c.month}
                </div>

                <h3 className="text-lg font-semibold mb-6">
                  Distribución estratégica
                </h3>

                <div className="space-y-5">

                  <div className="space-y-1">
                    <p className="text-gray-300 text-sm">
                      Producción
                    </p>

                    <p className="text-green-400 font-bold text-lg">
                      {c.production}%
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-gray-300 text-sm">
                      Operación
                    </p>

                    <p className="font-semibold text-lg">
                      {c.operation}%
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-gray-300 text-sm">
                      Distribución
                    </p>

                    <p className="font-semibold text-lg">
                      {c.distribution}%
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-gray-300 text-sm">
                      Comercial
                    </p>

                    <p className="font-semibold text-lg">
                      {c.commercial}%
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-gray-300 text-sm">
                      Administración
                    </p>

                    <p className="font-semibold text-lg">
                      {c.administration}%
                    </p>
                  </div>

                  <div className="border-t border-white/10 pt-4">

                    <div className="space-y-1">
                      <p className="text-gray-300 text-sm">
                        Total distribuido
                      </p>

                      <p className="text-green-400 font-bold text-xl">
                        {total}%
                      </p>
                    </div>

                  </div>

                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex justify-between">

                <button
                  onClick={() => handleEdit(c)}
                  className="text-blue-400 hover:underline text-sm"
                >
                  Editar
                </button>

                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-red-400 hover:underline text-sm"
                >
                  Eliminar
                </button>

              </div>

            </div>
          );
        })}

      </div>
    )}
  </div>
)}
  </DashboardLayout>
);
}























































































