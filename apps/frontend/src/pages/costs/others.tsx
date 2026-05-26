"use client";

import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import Button from "@/components/Button";
import { showError, showSuccess } from "@/utils/toast";
import { apiFetch } from "@/lib/api";

export default function OtherCostsPage() {
  const [month, setMonth] = useState("");

  // NUEVO NAMING INTERNO
  const [structuralCosts, setStructuralCosts] = useState(0);
  const [utilityCosts, setUtilityCosts] = useState(0);
  const [payrollCosts, setPayrollCosts] = useState(0);
  const [projectedProduction, setProjectedProduction] = useState(0);

  const [costsList, setCostsList] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
 const [activeConfig, setActiveConfig] = useState<any | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value || 0);
  };

  const analytics = useMemo(() => {
    const totalMonthly =
      Number(structuralCosts || 0) +
      Number(utilityCosts || 0) +
      Number(payrollCosts || 0);

    const perPlate =
      projectedProduction > 0
        ? totalMonthly / projectedProduction
        : 0;

    let status = {
    label: "Ingresa datos para simular",
      color: "text-gray-300",
    };

    if (perPlate > 5000) {
      status = {
        label: "🔴 Overhead operativo elevado",
        color: "text-red-400",
      };
    } else if (perPlate >= 2000) {
      status = {
        label: "🟡 Revisar eficiencia operativa",
        color: "text-yellow-400",
      };
    } else if (perPlate > 0) {
      status = {
        label: "🟢 Estructura operativa saludable",
        color: "text-green-400",
      };
    }

    return {
      totalMonthly,
      perPlate,
      status,
    };
  }, [
    structuralCosts,
    utilityCosts,
    payrollCosts,
    projectedProduction,
  ]);

  const activeAnalytics = useMemo(() => {
  if (!activeConfig) return null;

  const total =
    Number(activeConfig.fixedCosts || 0) +
    Number(activeConfig.variableCosts || 0) +
    Number(activeConfig.payroll || 0);

  const perPlate =
    Number(activeConfig.monthlyProduction || 0) > 0
      ? total / Number(activeConfig.monthlyProduction)
      : 0;

  let status = {
    label: "Sin configuración activa",
    color: "text-gray-300",
  };

  if (perPlate > 5000) {
    status = {
      label: "🔴 Overhead operativo elevado",
      color: "text-red-400",
    };
  } else if (perPlate >= 2000) {
    status = {
      label: "🟡 Revisar eficiencia operativa",
      color: "text-yellow-400",
    };
  } else if (perPlate > 0) {
    status = {
      label: "🟢 Estructura operativa saludable",
      color: "text-green-400",
    };
  }

  return {
    total,
    perPlate,
    status,
  };
}, [activeConfig]);

  // TRAER COSTOS
  const fetchCosts = async () => {
    try {
      const data = await apiFetch("/costs/others");

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
        ? `/costs/others/${editingId}`
        : "/costs/others";

      const method = editingId ? "PUT" : "POST";

      // BACKEND COMPATIBLE
      await apiFetch(endpoint, {
        method,
        body: JSON.stringify({
          month,
          fixedCosts: structuralCosts,
          variableCosts: utilityCosts,
          payroll: payrollCosts,
          monthlyProduction: projectedProduction,
        }),
      });

      showSuccess(
        editingId
          ? "Costos operativos actualizados"
          : "Costos operativos guardados"
      );
     await fetchCosts();
      setEditingId(null);
      setMonth("");
      setStructuralCosts(0);
      setUtilityCosts(0);
      setPayrollCosts(0);
      setProjectedProduction(0);

      fetchCosts();
    } catch (error) {
      console.error(error);
      showError("Error al guardar costos");
    }
  };

  // EDITAR
  const handleEdit = (cost: any) => {
    setEditingId(cost.id);
    setMonth(cost.month);

    // MAPEO DESDE BACKEND LEGACY
    setStructuralCosts(Number(cost.fixedCosts || 0));
    setUtilityCosts(Number(cost.variableCosts || 0));
    setPayrollCosts(Number(cost.payroll || 0));
    setProjectedProduction(Number(cost.monthlyProduction || 0));
  };

  // ELIMINAR
  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este registro?")) return;

    try {
      await apiFetch(`/costs/others/${id}`, {
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
        Costos Operativos
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* FORMULARIO */}
        <div className="lg:col-span-2 bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)] space-y-6">
          {/* PERIODO */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Periodo contable
            </h2>

            <p className="text-sm text-gray-600 mb-3">
              Selecciona el mes al que corresponden estos costos operativos.
            </p>

            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border p-3 rounded-xl w-64"
            />
          </div>

          {/* ESTRUCTURALES */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Costos estructurales
            </h2>

            <p className="text-sm text-gray-600 mb-3">
              Arriendo, software, internet, seguros, contabilidad,
              licencias y mantenimiento locativo.
            </p>

            <input
              type="number"
              min="0"
              value={structuralCosts}
              onChange={(e) =>
                setStructuralCosts(Number(e.target.value))
              }
              className="border p-3 rounded-xl w-full text-right"
            />
          </div>

          {/* OPERATIVOS */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Servicios operativos
            </h2>

            <p className="text-sm text-gray-600 mb-3">
              Agua, gas, electricidad, limpieza, control de plagas
              e insumos operativos generales.
            </p>

            <input
              type="number"
              min="0"
              value={utilityCosts}
              onChange={(e) =>
                setUtilityCosts(Number(e.target.value))
              }
              className="border p-3 rounded-xl w-full text-right"
            />
          </div>

          {/* NOMINA */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Nómina total mensual
            </h2>

            <p className="text-sm text-gray-600 mb-3">
              Personal operativo y administrativo mientras no exista
              costeo basado en ventas reales.
            </p>

            <input
              type="number"
              min="0"
              value={payrollCosts}
              onChange={(e) =>
                setPayrollCosts(Number(e.target.value))
              }
              className="border p-3 rounded-xl w-full text-right"
            />
          </div>

          {/* PRODUCCION */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Producción mensual proyectada
            </h2>

            <p className="text-sm text-gray-600 mb-3">
              Número total estimado de platos vendidos durante el mes
              con base en histórico o proyección operativa.
            </p>

            <input
              type="number"
              min="1"
              value={projectedProduction}
              onChange={(e) =>
                setProjectedProduction(Number(e.target.value))
              }
              className="border p-3 rounded-xl w-full text-right"
            />
          </div>

          <Button onClick={handleSave}>
            {editingId
              ? "Actualizar costos operativos"
              : "Guardar costos operativos"}
          </Button>
        </div>
    
   {/* PANELES */}
<div className="space-y-6">
  {/* SIMULADOR */}
  <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-6 shadow-xl space-y-6">
    <h2 className="text-xl font-semibold">
      Simulación operativa
    </h2>

    <div className="flex justify-between">
      <span>Overhead mensual total</span>
      <span className="text-green-400 font-bold">
        {formatCurrency(analytics.totalMonthly)}
      </span>
    </div>

    <div className="flex justify-between">
      <span>Overhead operativo por plato</span>
      <span className="text-green-400 font-bold">
        {formatCurrency(analytics.perPlate)}
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

  {/* CONFIGURACION VIGENTE */}
  {activeAnalytics && (
    <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-6 shadow-xl space-y-4">
      <h2 className="text-xl font-semibold">
        Configuración operativa vigente
      </h2>

      <div className="text-sm text-gray-300">
        Periodo: {activeConfig.month}
      </div>

      <div className="flex justify-between">
        <span>Overhead mensual</span>
        <span className="text-green-400 font-bold">
          {formatCurrency(activeAnalytics.total)}
        </span>
      </div>

      <div className="flex justify-between">
        <span>Producción proyectada</span>
        <span className="font-bold">
          {activeConfig.monthlyProduction}
        </span>
      </div>

      <div className="flex justify-between">
        <span>Overhead por plato</span>
        <span className="text-green-400 font-bold">
          {formatCurrency(activeAnalytics.perPlate)}
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
      {/* HISTORIAL */}
      <div className="mt-10">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl px-6 py-4 shadow-xl hover:shadow-2xl transition-all duration-300"
        >
          {showHistory
            ? "▲ Ocultar historial de costos"
            : "▼ Ver historial de costos"}
        </button>
      </div>

      {showHistory && (
        <div className="mt-6">
          {costsList.length === 0 ? (
            <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-10 text-center text-gray-700 shadow-xl">
              No hay registros de costos
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {costsList.map((c) => {
                const total =
                  Number(c.fixedCosts || 0) +
                  Number(c.variableCosts || 0) +
                  Number(c.payroll || 0);

                const perPlate =
                  c.monthlyProduction > 0
                    ? total / c.monthlyProduction
                    : 0;

                return (
                  <div
                    key={c.id}
                    className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white rounded-2xl p-5 shadow-xl hover:scale-[1.02] hover:shadow-2xl transition-all duration-300"
                  >
                    <div className="text-xs text-gray-400 mb-2">
                      {c.month}
                    </div>

                    <h3 className="text-lg font-semibold mb-4">
                      Registro operativo
                    </h3>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Estructurales</span>
                        <span className="text-green-400 font-semibold">
                          {formatCurrency(c.fixedCosts)}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span>Servicios operativos</span>
                        <span className="text-green-400 font-semibold">
                          {formatCurrency(c.variableCosts)}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span>Nómina total</span>
                        <span className="text-green-400 font-semibold">
                          {formatCurrency(c.payroll)}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span>Producción proyectada</span>
                        <span className="font-semibold">
                          {c.monthlyProduction}
                        </span>
                      </div>

                      <div className="border-t border-white/10 pt-3 mt-3">
                        <div className="flex justify-between">
                          <span>Total mensual</span>
                          <span className="text-green-400 font-bold">
                            {formatCurrency(total)}
                          </span>
                        </div>

                        <div className="flex justify-between mt-2">
                          <span>Overhead / plato</span>
                          <span className="text-green-400 font-bold">
                            {formatCurrency(perPlate)}
                          </span>
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
       </div>
       </div>
    </DashboardLayout>
  );
}