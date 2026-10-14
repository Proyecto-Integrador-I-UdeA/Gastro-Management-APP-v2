"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/Button";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  closeFinancePayroll,
  createFinanceEmployee,
  deleteFinanceEmployee,
  deleteFinancePayrollEntry,
  fetchFinancePayroll,
  generateFinancePayroll,
  reopenFinancePayroll,
  updateFinanceEmployee,
  updateFinancePayrollEntry,
  type FinanceEmployee,
  type FinancePayrollArea,
  type FinancePayrollEntry,
  type FinancePayrollResponse,
} from "@/lib/financePayrollApi";
import { getUserPermissions } from "@/utils/permissions";

const areaLabels: Record<FinancePayrollArea, string> = {
  KITCHEN: "Cocina",
  SERVICE: "Servicio",
  ADMIN: "Administración",
  SUPPORT: "Caja y apoyo",
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

const emptyEmployeeForm = {
  fullName: "",
  nationalId: "",
  area: "KITCHEN" as FinancePayrollArea,
  position: "",
  hiredAt: "",
  monthlySalary: "",
  active: true,
};

const emptyEntryForm = {
  salary: "",
  extras: "",
  deductions: "",
  benefits: "",
  note: "",
};

export default function FinancePayrollPage() {
  useAuthGuard("accounting.read");

  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<FinancePayrollResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [entryForm, setEntryForm] = useState(emptyEntryForm);
  const canUpdate = useMemo(
    () => getUserPermissions().includes("accounting.update"),
    [],
  );

  const load = useCallback(async (selectedMonth: string) => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchFinancePayroll(selectedMonth));
    } catch (cause) {
      setError(getApiErrorMessage(cause, "No se pudo cargar la nómina"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(month);
  }, [load, month]);

  const period = data?.period ?? null;
  const isOpen = period?.status === "OPEN";

  function openCreateEmployee() {
    setShowEmployeeForm(true);
    setEditingEmployeeId(null);
    setEmployeeForm(emptyEmployeeForm);
    setEditingEntryId(null);
    setError("");
  }

  function openEditEmployee(employee: FinanceEmployee) {
    setShowEmployeeForm(true);
    setEditingEmployeeId(employee.id);
    setEmployeeForm({
      fullName: employee.fullName,
      nationalId: employee.nationalId,
      area: employee.area,
      position: employee.position,
      hiredAt: employee.hiredAt,
      monthlySalary: String(employee.monthlySalary),
      active: employee.active,
    });
    setEditingEntryId(null);
    setError("");
  }

  function closeEmployeeForm() {
    setShowEmployeeForm(false);
    setEditingEmployeeId(null);
    setEmployeeForm(emptyEmployeeForm);
  }

  async function saveEmployee(event: FormEvent) {
    event.preventDefault();
    const monthlySalary = Number(employeeForm.monthlySalary);
    if (!Number.isFinite(monthlySalary) || monthlySalary <= 0) {
      setError("El salario mensual debe ser mayor a 0.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload = {
        fullName: employeeForm.fullName.trim(),
        nationalId: employeeForm.nationalId.trim(),
        area: employeeForm.area,
        position: employeeForm.position.trim(),
        hiredAt: employeeForm.hiredAt,
        monthlySalary,
        active: employeeForm.active,
      };
      if (editingEmployeeId) {
        await updateFinanceEmployee(editingEmployeeId, payload);
      } else {
        await createFinanceEmployee(payload);
      }
      closeEmployeeForm();
      await load(month);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "No se pudo guardar el colaborador"));
    } finally {
      setSaving(false);
    }
  }

  async function removeEmployee(employee: FinanceEmployee) {
    if (!confirm(`¿Quitar a "${employee.fullName}" de la plantilla? Si ya tiene nóminas, queda inactivo.`)) return;
    setError("");
    try {
      await deleteFinanceEmployee(employee.id);
      if (editingEmployeeId === employee.id) closeEmployeeForm();
      await load(month);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "No se pudo quitar el colaborador"));
    }
  }

  async function generate() {
    setSaving(true);
    setError("");
    try {
      setData(await generateFinancePayroll(month));
    } catch (cause) {
      setError(getApiErrorMessage(cause, "No se pudo generar la nómina"));
    } finally {
      setSaving(false);
    }
  }

  function openEditEntry(entry: FinancePayrollEntry) {
    setEditingEntryId(entry.id);
    setShowEmployeeForm(false);
    setEntryForm({
      salary: String(entry.salary),
      extras: String(entry.extras),
      deductions: String(entry.deductions),
      benefits: String(entry.benefits),
      note: entry.note ?? "",
    });
    setError("");
  }

  async function saveEntry(event: FormEvent) {
    event.preventDefault();
    if (!editingEntryId) return;
    const salary = Number(entryForm.salary);
    const extras = Number(entryForm.extras);
    const deductions = Number(entryForm.deductions);
    const benefits = Number(entryForm.benefits);
    if ([salary, extras, deductions, benefits].some((value) => !Number.isFinite(value) || value < 0)) {
      setError("Los valores de la línea deben ser números mayores o iguales a 0.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await updateFinancePayrollEntry(editingEntryId, {
        salary,
        extras,
        deductions,
        benefits,
        note: entryForm.note.trim() || null,
      });
      setEditingEntryId(null);
      setEntryForm(emptyEntryForm);
      await load(month);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "No se pudo actualizar la línea"));
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(entry: FinancePayrollEntry) {
    if (!confirm(`¿Quitar a "${entry.fullName}" de esta nómina?`)) return;
    setError("");
    try {
      await deleteFinancePayrollEntry(entry.id);
      if (editingEntryId === entry.id) {
        setEditingEntryId(null);
        setEntryForm(emptyEntryForm);
      }
      await load(month);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "No se pudo quitar la línea"));
    }
  }

  async function closePeriod() {
    if (!period) return;
    if (!confirm("Al cerrar, esta nómina queda como pagada y no se edita hasta reabrirla.")) return;
    setSaving(true);
    setError("");
    try {
      setData(await closeFinancePayroll(period.id));
    } catch (cause) {
      setError(getApiErrorMessage(cause, "No se pudo cerrar la nómina"));
    } finally {
      setSaving(false);
    }
  }

  async function reopenPeriod() {
    if (!period) return;
    setSaving(true);
    setError("");
    try {
      setData(await reopenFinancePayroll(period.id));
    } catch (cause) {
      setError(getApiErrorMessage(cause, "No se pudo reabrir la nómina"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#001F3F]">Nómina</h1>
            <p className="mt-2 text-gray-600">
              Plantilla de colaboradores y corrida mensual: salario, extras, deducciones y prestaciones.
            </p>
          </div>
          <label className="block text-sm font-semibold text-gray-700">
            Periodo
            <input
              type="month"
              aria-label="Periodo"
              value={month}
              onChange={(event) => {
                closeEmployeeForm();
                setEditingEntryId(null);
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

        {showEmployeeForm && canUpdate && (
          <form onSubmit={saveEmployee} className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#001F3F]">
              {editingEmployeeId ? "Editar colaborador" : "Nuevo colaborador"}
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-semibold text-gray-700">
                Nombre
                <input
                  required
                  aria-label="Nombre"
                  value={employeeForm.fullName}
                  onChange={(event) => setEmployeeForm((current) => ({ ...current, fullName: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Documento
                <input
                  required
                  aria-label="Documento"
                  value={employeeForm.nationalId}
                  onChange={(event) => setEmployeeForm((current) => ({ ...current, nationalId: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Área
                <select
                  aria-label="Área"
                  value={employeeForm.area}
                  onChange={(event) => setEmployeeForm((current) => ({
                    ...current,
                    area: event.target.value as FinancePayrollArea,
                  }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                >
                  {Object.entries(areaLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Cargo
                <input
                  required
                  aria-label="Cargo"
                  value={employeeForm.position}
                  onChange={(event) => setEmployeeForm((current) => ({ ...current, position: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Ingreso
                <input
                  required
                  aria-label="Ingreso"
                  type="date"
                  value={employeeForm.hiredAt}
                  onChange={(event) => setEmployeeForm((current) => ({ ...current, hiredAt: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Salario mensual
                <input
                  required
                  aria-label="Salario mensual"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={employeeForm.monthlySalary}
                  onChange={(event) => setEmployeeForm((current) => ({ ...current, monthlySalary: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                />
              </label>
              {editingEmployeeId && (
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={employeeForm.active}
                    onChange={(event) => setEmployeeForm((current) => ({ ...current, active: event.target.checked }))}
                  />
                  Activo
                </label>
              )}
            </div>
            <div className="mt-4 flex gap-3">
              <Button type="submit" disabled={saving}>
                {editingEmployeeId ? "Actualizar colaborador" : "Guardar colaborador"}
              </Button>
              <Button type="button" variant="secondary" onClick={closeEmployeeForm}>Cancelar</Button>
            </div>
          </form>
        )}

        {editingEntryId && canUpdate && (
          <form onSubmit={saveEntry} className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-[#001F3F]">Ajustar línea de nómina</h2>
            <p className="mt-1 text-sm text-gray-600">
              Neto = salario + extras − deducciones. Costo del restaurante = salario + extras + prestaciones.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-semibold text-gray-700">
                Salario del periodo
                <input
                  required
                  aria-label="Salario del periodo"
                  type="number"
                  min="0"
                  step="0.01"
                  value={entryForm.salary}
                  onChange={(event) => setEntryForm((current) => ({ ...current, salary: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Extras
                <input
                  required
                  aria-label="Extras"
                  type="number"
                  min="0"
                  step="0.01"
                  value={entryForm.extras}
                  onChange={(event) => setEntryForm((current) => ({ ...current, extras: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                />
                <span className="mt-1 block text-xs font-normal text-gray-500">Horas extra, bonos o propinas.</span>
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Deducciones
                <input
                  required
                  aria-label="Deducciones"
                  type="number"
                  min="0"
                  step="0.01"
                  value={entryForm.deductions}
                  onChange={(event) => setEntryForm((current) => ({ ...current, deductions: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                />
                <span className="mt-1 block text-xs font-normal text-gray-500">Retenciones del colaborador (seguridad social, renta, adelantos).</span>
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Prestaciones
                <input
                  required
                  aria-label="Prestaciones"
                  type="number"
                  min="0"
                  step="0.01"
                  value={entryForm.benefits}
                  onChange={(event) => setEntryForm((current) => ({ ...current, benefits: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                />
                <span className="mt-1 block text-xs font-normal text-gray-500">Cargas a cargo del restaurante.</span>
              </label>
              <label className="block text-sm font-semibold text-gray-700 md:col-span-2">
                Nota
                <input
                  aria-label="Nota"
                  value={entryForm.note}
                  onChange={(event) => setEntryForm((current) => ({ ...current, note: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                />
              </label>
            </div>
            <div className="mt-4 flex gap-3">
              <Button type="submit" disabled={saving}>Actualizar línea</Button>
              <Button type="button" variant="secondary" onClick={() => { setEditingEntryId(null); setEntryForm(emptyEntryForm); }}>
                Cancelar
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="rounded-xl bg-white p-6 text-gray-600 shadow-sm">Cargando nómina…</div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-[#001F3F]">Colaboradores</h2>
                {canUpdate && <Button type="button" onClick={openCreateEmployee}>+ Agregar</Button>}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b text-left text-gray-500">
                    <tr>
                      <th className="py-2 pr-3">Nombre</th>
                      <th className="py-2 pr-3">Documento</th>
                      <th className="py-2 pr-3">Área</th>
                      <th className="py-2 pr-3">Cargo</th>
                      <th className="py-2 pr-3">Salario</th>
                      <th className="py-2 pr-3">Estado</th>
                      {canUpdate && <th className="py-2">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.employees ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={canUpdate ? 7 : 6} className="py-8 text-center text-gray-500">
                          No hay colaboradores. Agrégalos para poder generar la nómina del mes.
                        </td>
                      </tr>
                    ) : (
                      (data?.employees ?? []).map((employee) => (
                        <tr key={employee.id} className="border-b border-gray-100">
                          <td className="py-2 pr-3 font-semibold">{employee.fullName}</td>
                          <td className="py-2 pr-3">{employee.nationalId}</td>
                          <td className="py-2 pr-3">{areaLabels[employee.area]}</td>
                          <td className="py-2 pr-3">{employee.position}</td>
                          <td className="py-2 pr-3">{formatCurrency(employee.monthlySalary)}</td>
                          <td className="py-2 pr-3">{employee.active ? "Activo" : "Inactivo"}</td>
                          {canUpdate && (
                            <td className="space-x-3 py-2 whitespace-nowrap">
                              <button type="button" className="text-sm text-blue-700 hover:underline" onClick={() => openEditEmployee(employee)}>
                                Editar
                              </button>
                              <button type="button" className="text-sm text-red-700 hover:underline" onClick={() => void removeEmployee(employee)}>
                                Quitar
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#001F3F]">Nómina del periodo</h2>
                  {period && (
                    <p className="mt-1 text-sm text-gray-600">
                      {period.status === "OPEN" ? "Abierta · se puede ajustar y cerrar cuando se pague." : "Cerrada · queda como registro del mes."}
                    </p>
                  )}
                </div>
                {canUpdate && (
                  <div className="flex gap-2">
                    {(!period || isOpen) && (
                      <Button type="button" disabled={saving} onClick={() => void generate()}>
                        {period ? "Actualizar con plantilla" : "Generar nómina"}
                      </Button>
                    )}
                    {isOpen && (
                      <Button type="button" disabled={saving} onClick={() => void closePeriod()}>
                        Cerrar periodo
                      </Button>
                    )}
                    {period?.status === "CLOSED" && (
                      <Button type="button" variant="secondary" disabled={saving} onClick={() => void reopenPeriod()}>
                        Reabrir
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b text-left text-gray-500">
                    <tr>
                      <th className="py-2 pr-3">Colaborador</th>
                      <th className="py-2 pr-3">Área</th>
                      <th className="py-2 pr-3">Salario</th>
                      <th className="py-2 pr-3">Extras</th>
                      <th className="py-2 pr-3">Deducciones</th>
                      <th className="py-2 pr-3">Prestaciones</th>
                      <th className="py-2 pr-3">Neto</th>
                      <th className="py-2 pr-3">Costo</th>
                      {canUpdate && isOpen && <th className="py-2">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {!period || period.entries.length === 0 ? (
                      <tr>
                        <td colSpan={canUpdate && isOpen ? 9 : 8} className="py-8 text-center text-gray-500">
                          {period
                            ? "No hay líneas en este periodo."
                            : "Genera la nómina para copiar los colaboradores activos de este mes."}
                        </td>
                      </tr>
                    ) : (
                      period.entries.map((entry) => (
                        <tr key={entry.id} className="border-b border-gray-100">
                          <td className="py-2 pr-3 font-semibold">{entry.fullName}</td>
                          <td className="py-2 pr-3">{areaLabels[entry.area]}</td>
                          <td className="py-2 pr-3">{formatCurrency(entry.salary)}</td>
                          <td className="py-2 pr-3">{formatCurrency(entry.extras)}</td>
                          <td className="py-2 pr-3">{formatCurrency(entry.deductions)}</td>
                          <td className="py-2 pr-3">{formatCurrency(entry.benefits)}</td>
                          <td className="py-2 pr-3">{formatCurrency(entry.net)}</td>
                          <td className="py-2 pr-3">{formatCurrency(entry.employerCost)}</td>
                          {canUpdate && isOpen && (
                            <td className="space-x-3 py-2 whitespace-nowrap">
                              <button type="button" className="text-sm text-blue-700 hover:underline" onClick={() => openEditEntry(entry)}>
                                Ajustar
                              </button>
                              <button type="button" className="text-sm text-red-700 hover:underline" onClick={() => void removeEntry(entry)}>
                                Quitar
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-[#001F3F]">Nómina por área</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b text-left text-gray-500">
                    <tr>
                      <th className="py-2 pr-3">Área</th>
                      <th className="py-2 pr-3">Empleados</th>
                      <th className="py-2 pr-3">Salarios</th>
                      <th className="py-2 pr-3">Prestaciones</th>
                      <th className="py-2 pr-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(period?.byArea ?? []).map((row) => (
                      <tr key={row.area} className="border-b border-gray-100">
                        <td className="py-2 pr-3 font-semibold">{areaLabels[row.area]}</td>
                        <td className="py-2 pr-3">{row.employeeCount}</td>
                        <td className="py-2 pr-3">{formatCurrency(row.salaries)}</td>
                        <td className="py-2 pr-3">{formatCurrency(row.benefits)}</td>
                        <td className="py-2 pr-3">{formatCurrency(row.total)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="py-2 pr-3 font-semibold">Total</td>
                      <td className="py-2 pr-3">{period?.totals.employeeCount ?? 0}</td>
                      <td className="py-2 pr-3">{formatCurrency(period?.totals.salaries ?? 0)}</td>
                      <td className="py-2 pr-3">{formatCurrency(period?.totals.benefits ?? 0)}</td>
                      <td className="py-2 pr-3">{formatCurrency(period?.totals.employerCost ?? 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
