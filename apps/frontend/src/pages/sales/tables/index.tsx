"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { apiFetch } from "@/utils/apiFetch";
import { getUserPermissions } from "@/utils/permissions";

type OperationalStatus = "AVAILABLE" | "OCCUPIED" | "OUT_OF_SERVICE";

type SalesTable = {
  id: number;
  code: string;
  area: string | null;
  capacity: number;
  active: boolean;
  operationalStatus: OperationalStatus;
  activeOrder: { id: number } | null;
};

type TablesResponse = { tables: SalesTable[] };

type ApiError = Error & {
  body?: { code?: string; error?: string };
};

const statusLabels: Record<OperationalStatus, string> = {
  AVAILABLE: "Disponible",
  OCCUPIED: "Ocupada",
  OUT_OF_SERVICE: "Fuera de servicio",
};

const statusClasses: Record<OperationalStatus, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-800",
  OCCUPIED: "bg-blue-100 text-blue-800",
  OUT_OF_SERVICE: "bg-slate-200 text-slate-700",
};

function sortTables(tables: SalesTable[]) {
  return [...tables].sort((a, b) => (
    (a.area ?? "").localeCompare(b.area ?? "")
    || a.code.localeCompare(b.code)
    || a.id - b.id
  ));
}

function tableErrorMessage(error: unknown, fallback: string) {
  const apiError = error as ApiError;
  const messages: Record<string, string> = {
    TABLE_CODE_ALREADY_EXISTS: "Ya existe una mesa con ese código.",
    TABLE_HAS_ACTIVE_ORDER: "No se puede poner fuera de servicio una mesa con un pedido abierto.",
    TABLE_NOT_FOUND: "La mesa ya no existe.",
  };
  const code = apiError.body?.code;
  return (code && messages[code]) || apiError.body?.error || apiError.message || fallback;
}

function parseCapacity(value: string): number | null {
  const capacity = Number(value);
  return Number.isInteger(capacity) && capacity > 0 ? capacity : null;
}

export default function SalesTablesAdminPage() {
  const router = useRouter();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [permissionReady, setPermissionReady] = useState(false);
  const [tables, setTables] = useState<SalesTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [savingKey, setSavingKey] = useState("");

  const [code, setCode] = useState("");
  const [area, setArea] = useState("");
  const [capacity, setCapacity] = useState("");
  const [active, setActive] = useState(true);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editArea, setEditArea] = useState("");
  const [editCapacity, setEditCapacity] = useState("");

  const canRead = permissions.includes("sales.read");
  const canManage = permissions.includes("sales.tables.manage");

  const loadTables = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const response = await apiFetch<TablesResponse>("/sales/tables");
      setTables(sortTables(response.tables));
    } catch (error) {
      setPageError(tableErrorMessage(error, "No fue posible cargar las mesas."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const currentPermissions = getUserPermissions();
    setPermissions(currentPermissions);
    setPermissionReady(true);
  }, []);

  useEffect(() => {
    if (permissionReady && canRead) void loadTables();
  }, [canRead, loadTables, permissionReady]);

  function validateFields(rawCode: string, rawCapacity: string) {
    if (!rawCode.trim()) return "El código de la mesa es obligatorio.";
    if (parseCapacity(rawCapacity) === null) {
      return "La capacidad debe ser un entero mayor que 0.";
    }
    return "";
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!canManage || savingKey) return;
    const validationError = validateFields(code, capacity);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSavingKey("create");
    setFormError("");
    try {
      const created = await apiFetch<SalesTable>("/sales/tables", {
        method: "POST",
        json: {
          code: code.trim(),
          area: area.trim() || null,
          capacity: parseCapacity(capacity),
          active,
        },
      });
      setTables(current => sortTables([...current, created]));
      setCode("");
      setArea("");
      setCapacity("");
      setActive(true);
    } catch (error) {
      setFormError(tableErrorMessage(error, "No fue posible crear la mesa."));
    } finally {
      setSavingKey("");
    }
  }

  function startEditing(table: SalesTable) {
    setEditingId(table.id);
    setEditCode(table.code);
    setEditArea(table.area ?? "");
    setEditCapacity(String(table.capacity));
    setFormError("");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditCode("");
    setEditArea("");
    setEditCapacity("");
  }

  async function handleEdit(event: FormEvent, table: SalesTable) {
    event.preventDefault();
    if (!canManage || savingKey) return;
    const validationError = validateFields(editCode, editCapacity);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSavingKey(`edit-${table.id}`);
    setFormError("");
    try {
      const updated = await apiFetch<SalesTable>(`/sales/tables/${table.id}`, {
        method: "PATCH",
        json: {
          code: editCode.trim(),
          area: editArea.trim() || null,
          capacity: parseCapacity(editCapacity),
        },
      });
      setTables(current => sortTables(current.map(item => (
        item.id === updated.id ? updated : item
      ))));
      cancelEditing();
    } catch (error) {
      setFormError(tableErrorMessage(error, "No fue posible actualizar la mesa."));
    } finally {
      setSavingKey("");
    }
  }

  async function toggleTable(table: SalesTable) {
    if (!canManage || savingKey) return;
    setSavingKey(`active-${table.id}`);
    setFormError("");
    try {
      const updated = await apiFetch<SalesTable>(`/sales/tables/${table.id}`, {
        method: "PATCH",
        json: { active: !table.active },
      });
      setTables(current => sortTables(current.map(item => (
        item.id === updated.id ? updated : item
      ))));
    } catch (error) {
      setFormError(tableErrorMessage(error, "No fue posible cambiar el estado de la mesa."));
    } finally {
      setSavingKey("");
    }
  }

  if (!permissionReady) {
    return <DashboardLayout><div className="p-6 text-slate-600">Cargando configuración...</div></DashboardLayout>;
  }

  if (!canRead) {
    return (
      <DashboardLayout>
        <div className="m-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          No tienes permiso para consultar las mesas.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Ventas / Configuración</p>
            <h1 className="mt-1 text-3xl font-bold text-[#001F3F]">Configuración de mesas</h1>
            <p className="mt-2 text-slate-600">Define el código, área, capacidad y disponibilidad operativa del salón.</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-[#001F3F] px-4 py-2 text-sm font-semibold text-[#001F3F]"
            onClick={() => void router.push("/sales/orders")}
          >Volver a Mesas y pedidos</button>
        </div>

        {pageError && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{pageError}</div>}
        {formError && <div role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">{formError}</div>}

        {canManage && (
          <form className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_1fr_140px_auto] md:items-end" onSubmit={handleCreate}>
            <label className="text-sm font-medium text-slate-700">
              Código o nombre
              <input aria-label="Código o nombre" className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={code} onChange={event => setCode(event.target.value)} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Área
              <input aria-label="Área" className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={area} onChange={event => setArea(event.target.value)} placeholder="Opcional" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Capacidad
              <input aria-label="Capacidad" type="number" min="1" step="1" className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={capacity} onChange={event => setCapacity(event.target.value)} />
            </label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} />
                Activa
              </label>
              <button type="submit" disabled={Boolean(savingKey)} className="rounded-lg bg-[#001F3F] px-4 py-2 font-semibold text-white disabled:opacity-50">Crear mesa</button>
            </div>
          </form>
        )}

        {!canManage && (
          <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            Vista de solo lectura. La configuración requiere el permiso sales.tables.manage.
          </div>
        )}

        {loading ? (
          <div className="rounded-xl bg-white p-8 text-center text-slate-600">Cargando mesas...</div>
        ) : tables.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">No hay mesas configuradas.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tables.map(table => (
              <article key={table.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                {editingId === table.id ? (
                  <form className="space-y-3" onSubmit={event => void handleEdit(event, table)}>
                    <label className="block text-sm font-medium text-slate-700">
                      Código o nombre
                      <input aria-label={`Editar código ${table.code}`} className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={editCode} onChange={event => setEditCode(event.target.value)} />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Área
                      <input aria-label={`Editar área ${table.code}`} className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={editArea} onChange={event => setEditArea(event.target.value)} />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Capacidad
                      <input aria-label={`Editar capacidad ${table.code}`} type="number" min="1" step="1" className="mt-1 w-full rounded-lg border border-slate-300 p-2" value={editCapacity} onChange={event => setEditCapacity(event.target.value)} />
                    </label>
                    <div className="flex gap-2">
                      <button type="submit" disabled={Boolean(savingKey)} className="rounded-lg bg-[#001F3F] px-3 py-2 text-sm font-semibold text-white">Guardar cambios</button>
                      <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={cancelEditing}>Cancelar</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">Mesa {table.code}</h2>
                        <p className="mt-1 text-sm text-slate-600">{table.area ?? "Sin área"} · {table.capacity} puestos</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[table.operationalStatus]}`}>
                        {statusLabels[table.operationalStatus]}
                      </span>
                    </div>
                    {table.activeOrder && <p className="mt-3 text-sm text-slate-600">Pedido abierto #{table.activeOrder.id}</p>}
                    {canManage && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" className="rounded-lg border border-[#001F3F] px-3 py-2 text-sm font-semibold text-[#001F3F]" onClick={() => startEditing(table)}>Editar</button>
                        <button
                          type="button"
                          disabled={Boolean(savingKey)}
                          className={`rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 ${table.active ? "bg-slate-700" : "bg-emerald-700"}`}
                          onClick={() => void toggleTable(table)}
                        >{table.active ? "Poner fuera de servicio" : "Activar"}</button>
                      </div>
                    )}
                  </>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
