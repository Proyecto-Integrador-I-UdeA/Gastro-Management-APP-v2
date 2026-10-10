"use client";

import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/Button";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  createFinanceExpense,
  deleteFinanceExpense,
  fetchFinanceExpenses,
  updateFinanceExpense,
  type FinanceExpenseItem,
  type FinanceExpenseKind,
  type FinanceExpensePeriodicity,
  type FinanceExpensesResponse,
} from "@/lib/financeExpensesApi";
import { getUserPermissions } from "@/utils/permissions";

const periodicityLabels: Record<FinanceExpensePeriodicity, string> = {
  MONTHLY: "Mensual",
  BIMONTHLY: "Bimestral",
  QUARTERLY: "Trimestral",
  ANNUAL: "Anual",
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

const emptyForm = {
  concept: "",
  amount: "",
  periodicity: "MONTHLY" as FinanceExpensePeriodicity,
  base: "",
  active: true,
};

export default function FinanceExpensesPage() {
  useAuthGuard("accounting.read");

  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<FinanceExpensesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formKind, setFormKind] = useState<FinanceExpenseKind | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const canUpdate = useMemo(
    () => getUserPermissions().includes("accounting.update"),
    [],
  );

  const load = useCallback(async (selectedMonth: string) => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchFinanceExpenses(selectedMonth));
    } catch (cause) {
      setError(getApiErrorMessage(cause, "No se pudieron cargar los gastos"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(month);
  }, [load, month]);

  function openCreate(kind: FinanceExpenseKind) {
    setFormKind(kind);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  function openEdit(item: FinanceExpenseItem) {
    setFormKind(item.kind);
    setEditingId(item.id);
    setForm({
      concept: item.concept,
      amount: String(item.amount),
      periodicity: item.periodicity ?? "MONTHLY",
      base: item.base ?? "",
      active: item.active,
    });
    setError("");
  }

  function closeForm() {
    setFormKind(null);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!formKind) return;

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("El valor debe ser un número mayor o igual a 0.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload = {
        kind: formKind,
        month,
        concept: form.concept.trim(),
        amount,
        active: form.active,
        ...(formKind === "FIXED"
          ? { periodicity: form.periodicity, base: null }
          : { base: form.base.trim(), periodicity: null }),
      };
      if (editingId) {
        await updateFinanceExpense(editingId, payload);
      } else {
        await createFinanceExpense(payload);
      }
      closeForm();
      await load(month);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "No se pudo guardar el rubro"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: FinanceExpenseItem) {
    if (!confirm(`¿Eliminar el rubro "${item.concept}"?`)) return;
    setError("");
    try {
      await deleteFinanceExpense(item.id);
      if (editingId === item.id) closeForm();
      await load(month);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "No se pudo eliminar el rubro"));
    }
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#001F3F]">Gastos</h1>
            <p className="mt-2 text-gray-600">
              Registra los gastos fijos y los costos indirectos variables del periodo.
            </p>
          </div>
          <label className="block text-sm font-semibold text-gray-700">
            Periodo
            <input
              type="month"
              aria-label="Periodo"
              value={month}
              onChange={(event) => {
                closeForm();
                setMonth(event.target.value);
              }}
              className="mt-1 block rounded-xl border border-gray-300 px-3 py-2"
            />
          </label>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
            {error}
          </div>
        )}

        {formKind && canUpdate && (
          <form
            onSubmit={save}
            className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-[#001F3F]">
              {editingId ? "Editar rubro" : "Nuevo rubro"} · {formKind === "FIXED" ? "Gasto fijo" : "Costo variable"}
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-semibold text-gray-700">
                Concepto
                <input
                  required
                  aria-label="Concepto"
                  value={form.concept}
                  onChange={(event) => setForm((current) => ({ ...current, concept: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Valor
                <input
                  required
                  aria-label="Valor"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                />
              </label>
              {formKind === "FIXED" ? (
                <>
                  <label className="block text-sm font-semibold text-gray-700">
                    Periodicidad
                    <select
                      aria-label="Periodicidad"
                      value={form.periodicity}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        periodicity: event.target.value as FinanceExpensePeriodicity,
                      }))}
                      className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                    >
                      {Object.entries(periodicityLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 pt-6 text-sm font-semibold text-gray-700">
                    <input
                      type="checkbox"
                      aria-label="Activo"
                      checked={form.active}
                      onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                    />
                    Activo
                  </label>
                </>
              ) : (
                <label className="block text-sm font-semibold text-gray-700 md:col-span-2">
                  Base
                  <input
                    required
                    aria-label="Base"
                    value={form.base}
                    onChange={(event) => setForm((current) => ({ ...current, base: event.target.value }))}
                    placeholder="Consumo, domicilios, pagos electrónicos…"
                    className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                  />
                </label>
              )}
            </div>
            <div className="mt-4 flex gap-3">
              <Button type="submit" disabled={saving}>
                {editingId ? "Actualizar rubro" : "Guardar rubro"}
              </Button>
              <Button type="button" variant="secondary" onClick={closeForm}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="rounded-xl bg-white p-6 text-gray-600 shadow-sm">Cargando gastos…</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ExpenseTable
              title="Gastos fijos"
              emptyLabel="No hay gastos fijos en este periodo."
              columns={["Concepto", "Periodicidad", "Valor mensual", "Estado"]}
              rows={data?.fixed ?? []}
              total={data?.totals.fixed ?? 0}
              canUpdate={canUpdate}
              onAdd={() => openCreate("FIXED")}
              onEdit={openEdit}
              onDelete={remove}
              renderRow={(item) => (
                <>
                  <td className="py-2 pr-3 font-semibold">{item.concept}</td>
                  <td className="py-2 pr-3">{item.periodicity ? periodicityLabels[item.periodicity] : "—"}</td>
                  <td className="py-2 pr-3">{formatCurrency(item.amount)}</td>
                  <td className="py-2 pr-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      item.active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"
                    }`}
                    >
                      {item.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </>
              )}
            />
            <ExpenseTable
              title="Costos indirectos variables"
              emptyLabel="No hay costos variables en este periodo."
              columns={["Concepto", "Base", "Valor del periodo"]}
              rows={data?.variable ?? []}
              total={data?.totals.variable ?? 0}
              canUpdate={canUpdate}
              onAdd={() => openCreate("VARIABLE")}
              onEdit={openEdit}
              onDelete={remove}
              renderRow={(item) => (
                <>
                  <td className="py-2 pr-3 font-semibold">{item.concept}</td>
                  <td className="py-2 pr-3">{item.base || "—"}</td>
                  <td className="py-2 pr-3">{formatCurrency(item.amount)}</td>
                </>
              )}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function ExpenseTable({
  title,
  emptyLabel,
  columns,
  rows,
  total,
  canUpdate,
  onAdd,
  onEdit,
  onDelete,
  renderRow,
}: {
  title: string;
  emptyLabel: string;
  columns: string[];
  rows: FinanceExpenseItem[];
  total: number;
  canUpdate: boolean;
  onAdd: () => void;
  onEdit: (item: FinanceExpenseItem) => void;
  onDelete: (item: FinanceExpenseItem) => void;
  renderRow: (item: FinanceExpenseItem) => ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#001F3F]">{title}</h2>
        {canUpdate && (
          <Button type="button" onClick={onAdd}>
            + Agregar
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b text-left text-gray-500">
            <tr>
              {columns.map((column) => (
                <th key={column} className="py-2 pr-3">{column}</th>
              ))}
              {canUpdate && <th className="py-2">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (canUpdate ? 1 : 0)} className="py-8 text-center text-gray-500">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  {renderRow(item)}
                  {canUpdate && (
                    <td className="space-x-3 py-2 whitespace-nowrap">
                      <button type="button" className="text-sm text-blue-700 hover:underline" onClick={() => onEdit(item)}>
                        Editar
                      </button>
                      <button type="button" className="text-sm text-red-700 hover:underline" onClick={() => onDelete(item)}>
                        Eliminar
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between text-sm font-semibold text-gray-700">
        <span>Total activo</span>
        <span>{formatCurrency(total)}</span>
      </div>
    </section>
  );
}
