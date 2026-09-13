"use client";

import { FormEvent, useEffect, useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { apiFetch } from "@/utils/apiFetch";
import { getUserPermissions } from "@/utils/permissions";

type WasteConfig = {
  wastePercent: number;
  updatedAt: string | null;
  updatedBy: { id: number; fullName: string | null } | null;
};

export default function CostSettingsPage() {
  useAuthGuard("costs.read");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const canUpdate = getUserPermissions().includes("costs.update");

  useEffect(() => {
    let active = true;
    apiFetch<WasteConfig>("/costs/settings/waste")
      .then(config => {
        if (active) setValue(String(config.wastePercent));
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : "No se pudo cargar la configuración");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    const wastePercent = Number(value);
    const validPrecision = /^\d+(?:\.\d{1,2})?$/.test(value.trim());
    if (!validPrecision || !Number.isFinite(wastePercent) || wastePercent < 0 || wastePercent > 100) {
      setError("La merma general debe estar entre 0 y 100 %, con máximo 2 decimales.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const config = await apiFetch<WasteConfig>("/costs/settings/waste", {
        method: "PUT",
        json: { wastePercent },
      });
      setValue(String(config.wastePercent));
      setSuccess("Merma general actualizada correctamente.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-[#001F3F]">Configuración de costos</h1>
        <p className="mt-2 text-slate-600">
          Define parámetros globales utilizados por el costeo y la operación del restaurante.
        </p>
        <form noValidate onSubmit={save} className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label htmlFor="global-waste-percent" className="block font-semibold text-slate-900">
            Merma general estimada
          </label>
          <div className="mt-3 flex max-w-xs items-center gap-2">
            <input
              id="global-waste-percent"
              aria-label="Merma general estimada"
              type="number"
              min="0"
              max="100"
              step="0.01"
              disabled={loading || saving || !canUpdate}
              value={value}
              onChange={event => setValue(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
            />
            <span className="font-semibold text-slate-700">%</span>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Este porcentaje se aplica al consumo teórico de las recetas para estimar la merma general y se utiliza tanto en el costo del plato como en el descuento automático de inventario.
          </p>
          {!canUpdate && <p className="mt-3 text-sm text-amber-800">Solo usuarios con permiso de edición de costos pueden modificar este valor.</p>}
          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
          {success && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-800">{success}</p>}
          {canUpdate && (
            <button
              type="submit"
              disabled={loading || saving}
              className="mt-5 rounded-lg bg-[#001F3F] px-5 py-2 font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar configuración"}
            </button>
          )}
        </form>
      </div>
    </DashboardLayout>
  );
}
