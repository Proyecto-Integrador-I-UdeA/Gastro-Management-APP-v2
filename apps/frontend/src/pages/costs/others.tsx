"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import Button from "@/components/Button";
import { showError, showSuccess } from "@/utils/toast";
import { apiFetch } from "@/lib/api"; // 🔥 IMPORTANTE

export default function OtherCostsPage() {

  const [month, setMonth] = useState("");
  const [fixedCosts, setFixedCosts] = useState(0);
  const [variableCosts, setVariableCosts] = useState(0);
  const [payroll, setPayroll] = useState(0);
  const [monthlyProduction, setMonthlyProduction] = useState(0);

  const [costsList, setCostsList] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  // 🔥 TRAER COSTOS
  const fetchCosts = async () => {
    try {
      const data = await apiFetch("/costs/others");

      const list = Array.isArray(data)
        ? data
        : data.data || data.costs || [];

      setCostsList(list);

    } catch (error) {
      console.error("Error cargando costos:", error);
    }
  };

  useEffect(() => {
    fetchCosts();
  }, []);

  // 🔥 GUARDAR / EDITAR
  const handleSave = async () => {
    try {
      const endpoint = editingId
        ? `/costs/others/${editingId}`
        : "/costs/others";

      const method = editingId ? "PUT" : "POST";

      await apiFetch(endpoint, {
        method,
        body: JSON.stringify({
          month,
          fixedCosts,
          variableCosts,
          payroll,
          monthlyProduction,
        }),
      });

      showSuccess(editingId ? "Costos actualizados" : "Costos guardados");

      // reset
      setEditingId(null);
      setMonth("");
      setFixedCosts(0);
      setVariableCosts(0);
      setPayroll(0);
      setMonthlyProduction(0);

      fetchCosts();

    } catch (error) {
      console.error(error);
      showError("Error al guardar costos");
    }
  };

  // 🔥 EDITAR
  const handleEdit = (cost: any) => {
    setEditingId(cost.id);
    setMonth(cost.month);
    setFixedCosts(cost.fixedCosts);
    setVariableCosts(cost.variableCosts);
    setPayroll(cost.payroll);
    setMonthlyProduction(cost.monthlyProduction);
  };

  // 🔥 ELIMINAR
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
        Otros Costos
      </h1>

      <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 space-y-6">

        {/* MES */}
        <div>
          <label className="text-sm text-gray-600">Mes</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border p-2 rounded w-60"
          />
        </div>

        {/* COSTOS FIJOS */}
        <div>
          <label className="text-sm text-gray-600">Costos fijos mensuales</label>
          <input
            type="number"
            min="0"
            value={fixedCosts}
            onChange={(e) => setFixedCosts(Number(e.target.value))}
            className="border p-2 rounded w-full"
          />
        </div>

        {/* COSTOS VARIABLES */}
        <div>
          <label className="text-sm text-gray-600">Costos variables mensuales</label>
          <input
            type="number"
            min="0"
            value={variableCosts}
            onChange={(e) => setVariableCosts(Number(e.target.value))}
            className="border p-2 rounded w-full"
          />
        </div>

        {/* NÓMINA */}
        <div>
          <label className="text-sm text-gray-600">Nómina mensual</label>
          <input
            type="number"
            min="0"
            value={payroll}
            onChange={(e) => setPayroll(Number(e.target.value))}
            className="border p-2 rounded w-full"
          />
        </div>

        {/* PRODUCCIÓN */}
        <div>
          <label className="text-sm text-gray-600">
            Producción mensual (platos)
          </label>
          <input
            type="number"
            min="1"
            value={monthlyProduction}
            onChange={(e) => setMonthlyProduction(Number(e.target.value))}
            className="border p-2 rounded w-full"
          />
        </div>

        <Button onClick={handleSave}>
          {editingId ? "Actualizar costos" : "Guardar costos"}
        </Button>

      </div>

      {/* TABLA */}
      <div className="mt-10 bg-white rounded-xl p-6 shadow">

        <h2 className="text-xl font-semibold mb-4">
          Historial de costos
        </h2>

        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2">Mes</th>
              <th>Fijos</th>
              <th>Variables</th>
              <th>Nómina</th>
              <th>Producción</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {costsList.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center p-4">
                  No hay registros
                </td>
              </tr>
            ) : (
              costsList.map((c) => (
                <tr key={c.id} className="text-center border-t">
                  <td className="p-2">{c.month}</td>
                  <td>{c.fixedCosts}</td>
                  <td>{c.variableCosts}</td>
                  <td>{c.payroll}</td>
                  <td>{c.monthlyProduction}</td>

                  <td className="space-x-2">
                    <button
                      onClick={() => handleEdit(c)}
                      className="text-blue-600 hover:underline"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

      </div>

    </DashboardLayout>
  );
}