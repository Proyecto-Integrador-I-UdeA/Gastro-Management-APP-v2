"use client";

import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import Button from "@/components/Button";
import { showError, showSuccess } from "@/utils/toast";
import { apiFetch } from "@/lib/api";

export default function VariableCostsPage() {
  const [month, setMonth] = useState("");

  // VARIABLES
  const [packagingCost, setPackagingCost] = useState(0);

  const [wastePercent, setWastePercent] = useState(0);

  const [
    paymentProcessingPercent,
    setPaymentProcessingPercent,
  ] = useState(0);

  const [
    platformCommissionPercent,
    setPlatformCommissionPercent,
  ] = useState(0);

  const [extraVariableCost, setExtraVariableCost] =
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
    const variableBaseCost =
      Number(packagingCost || 0) +
      Number(extraVariableCost || 0);

    let status = {
      label: "Configura valores para simular",
      color: "text-gray-300",
    };

    if (variableBaseCost >= 3000) {
      status = {
        label: "🔴 Estructura variable elevada",
        color: "text-red-400",
      };
    } else if (variableBaseCost >= 1500) {
      status = {
        label: "🟡 Costos variables moderados",
        color: "text-yellow-400",
      };
    } else if (variableBaseCost > 0) {
      status = {
        label: "🟢 Estructura variable saludable",
        color: "text-green-400",
      };
    }

    return {
      variableBaseCost,
      status,
    };
  }, [
    packagingCost,
    wastePercent,
    paymentProcessingPercent,
    platformCommissionPercent,
    extraVariableCost,
  ]);

  // CONFIGURACIÓN VIGENTE
  const activeAnalytics = useMemo(() => {
    if (!activeConfig) return null;

    const variableBaseCost =
      Number(activeConfig.packagingCost || 0) +
      Number(activeConfig.extraVariableCost || 0);

    let status = {
      label: "Sin configuración activa",
      color: "text-gray-300",
    };

    if (variableBaseCost >= 3000) {
      status = {
        label: "🔴 Estructura variable elevada",
        color: "text-red-400",
      };
    } else if (variableBaseCost >= 1500) {
      status = {
        label: "🟡 Costos variables moderados",
        color: "text-yellow-400",
      };
    } else if (variableBaseCost > 0) {
      status = {
        label: "🟢 Estructura variable saludable",
        color: "text-green-400",
      };
    }

    return {
      variableBaseCost,
      status,
    };
  }, [activeConfig]);

  // TRAER COSTOS
const fetchCosts = async () => {
  try {
    const data = await apiFetch("/costs/variables");

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
    console.error("Error cargando costos:", error);
  }
};

useEffect(() => {
  fetchCosts();
}, []);

// GUARDAR / EDITAR
const handleSave = async () => {
  try {
    const endpoint = editingId
      ? `/costs/variables/${editingId}`
      : "/costs/variables";

    const method = editingId ? "PUT" : "POST";

    await apiFetch(endpoint, {
      method,
      body: JSON.stringify({
        month,
        packagingCost,
        wastePercent,
        paymentProcessingPercent,
        platformCommissionPercent,
        extraVariableCost,
      }),
    });

    showSuccess(
      editingId
        ? "Costos variables actualizados"
        : "Costos variables guardados"
    );

    await fetchCosts();

    setEditingId(null);

    setMonth("");
    setPackagingCost(0);
    setWastePercent(0);
    setPaymentProcessingPercent(0);
    setPlatformCommissionPercent(0);
    setExtraVariableCost(0);

  } catch (error) {
    console.error(error);
    showError("Error al guardar costos variables");
  }
};

// EDITAR
const handleEdit = (cost: any) => {
  setEditingId(cost.id);

  setMonth(cost.month);

  setPackagingCost(
    Number(cost.packagingCost || 0)
  );

  setWastePercent(
    Number(cost.wastePercent || 0)
  );

  setPaymentProcessingPercent(
    Number(cost.paymentProcessingPercent || 0)
  );

  setPlatformCommissionPercent(
    Number(cost.platformCommissionPercent || 0)
  );

  setExtraVariableCost(
    Number(cost.extraVariableCost || 0)
  );
};

// ELIMINAR
const handleDelete = async (id: number) => {
  if (!confirm("¿Eliminar este registro?")) return;

  try {
    await apiFetch(`/costs/variables/${id}`, {
      method: "DELETE",
    });

    fetchCosts();
  } catch (error) {
    console.error(error);
  }
};

return (
  <DashboardLayout>
    <h1 className="text-3xl font-bold text-[#001F3F] mb-6">
      Costos Variables
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
            Selecciona el mes al que corresponden estos costos variables.
          </p>

          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border p-3 rounded-xl w-64"
          />
        </div>

        {/* EMPAQUES */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Empaque por plato
          </h2>

          <p className="text-sm text-gray-600 mb-3">
            Bolsas, recipientes, tapas, cubiertos y elementos de presentación.
          </p>

          <input
            type="number"
            min="0"
            value={packagingCost}
            onChange={(e) =>
              setPackagingCost(Number(e.target.value))
            }
            className="border p-3 rounded-xl w-full text-right"
          />
        </div>

        {/* MERMA */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Merma operativa (%)
          </h2>

          <p className="text-sm text-gray-600 mb-3">
            Pérdidas operativas por preparación, desperdicio y producción.
          </p>

          <input
            type="number"
            min="0"
            value={wastePercent}
            onChange={(e) =>
              setWastePercent(Number(e.target.value))
            }
            className="border p-3 rounded-xl w-full text-right"
          />
        </div>

        {/* MEDIOS DE PAGO */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Comisión medios de pago (%)
          </h2>

          <p className="text-sm text-gray-600 mb-3">
            Costos asociados a datáfonos, QR, transferencias y pasarelas.
          </p>

          <input
            type="number"
            min="0"
            value={paymentProcessingPercent}
            onChange={(e) =>
              setPaymentProcessingPercent(
                Number(e.target.value)
              )
            }
            className="border p-3 rounded-xl w-full text-right"
          />
        </div>

        {/* PLATAFORMAS */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Comisión plataformas (%)
          </h2>

          <p className="text-sm text-gray-600 mb-3">
            Comisión de aplicaciones y plataformas de venta.
          </p>

          <input
            type="number"
            min="0"
            value={platformCommissionPercent}
            onChange={(e) =>
              setPlatformCommissionPercent(
                Number(e.target.value)
              )
            }
            className="border p-3 rounded-xl w-full text-right"
          />
        </div>

        {/* EXTRA */}
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Costos variables extra
          </h2>

          <p className="text-sm text-gray-600 mb-3">
            Otros costos variables operativos por plato.
          </p>

          <input
            type="number"
            min="0"
            value={extraVariableCost}
            onChange={(e) =>
              setExtraVariableCost(
                Number(e.target.value)
              )
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
    Simulación variable
  </h2>

  <div className="flex justify-between">
    <span>Costo variable base</span>

    <span className="text-green-400 font-bold">
      {formatCurrency(
        analytics.variableBaseCost
      )}
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
    
    

        {/* CONFIG VIGENTE */}
        {activeAnalytics && (
          <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-6 shadow-xl space-y-4">

            <h2 className="text-xl font-semibold">
              Configuración variable vigente
            </h2>

            <div className="text-sm text-gray-300">
              Periodo: {activeConfig.month}
            </div>

            <div className="flex justify-between">
              <span>Empaque base</span>

              <span className="text-green-400 font-bold">
                {formatCurrency(
                  activeConfig.packagingCost
                )}
              </span>
            </div>

            <div className="flex justify-between">
              <span>Merma</span>

              <span className="font-bold">
                {activeConfig.wastePercent}%
              </span>
            </div>

            <div className="flex justify-between">
              <span>Pago electrónico</span>

              <span className="font-bold">
                {activeConfig.paymentProcessingPercent}%
              </span>
            </div>

            <div className="flex justify-between">
              <span>Plataformas</span>

              <span className="font-bold">
                {activeConfig.platformCommissionPercent}%
              </span>
            </div>

            <div className="flex justify-between">
              <span>Costo variable base</span>

              <span className="text-green-400 font-bold">
                {formatCurrency(
                  activeAnalytics.variableBaseCost
                )}
              </span>
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
    </div>
    
  {showHistory && (
  <div className="mt-10">
    {costsList.length === 0 ? (
      <div className="bg-gray-400/30 backdrop-blur-md border border-white/20 rounded-2xl p-10 text-center text-gray-700">
        No hay registros de costos variables
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

        {costsList.map((c) => {
          const variableBase =
            Number(c.packagingCost || 0) +
            Number(c.extraVariableCost || 0);

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
                  Registro variable
                </h3>

                <div className="space-y-5">

                  <div className="space-y-1">
                    <p className="text-gray-300 text-sm">
                      Empaque base
                    </p>

                    <p className="text-green-400 font-bold text-lg break-words">
                      {formatCurrency(c.packagingCost)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-gray-300 text-sm">
                      Merma operativa
                    </p>

                    <p className="font-semibold text-lg">
                      {c.wastePercent}%
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-gray-300 text-sm">
                      Pago electrónico
                    </p>

                    <p className="font-semibold text-lg">
                      {c.paymentProcessingPercent}%
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-gray-300 text-sm">
                      Plataformas
                    </p>

                    <p className="font-semibold text-lg">
                      {c.platformCommissionPercent}%
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-gray-300 text-sm">
                      Variables extra
                    </p>

                    <p className="text-green-400 font-bold text-lg break-words">
                      {formatCurrency(c.extraVariableCost)}
                    </p>
                  </div>

                  <div className="border-t border-white/10 pt-4">

                    <div className="space-y-1">
                      <p className="text-gray-300 text-sm">
                        Variable base/plato
                      </p>

                      <p className="text-green-400 font-bold text-xl break-words">
                        {formatCurrency(variableBase)}
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