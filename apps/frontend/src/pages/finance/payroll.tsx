"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/Button";
import PayrollCostReport from "@/components/finance/PayrollCostReport";
import PayrollReceipt from "@/components/finance/PayrollReceipt";
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
  type FinanceArlRiskClass,
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

const AUTOMATIC_CALCULATION_VERSION = "CO_BASIC_2026_V1";

const arlRiskClasses: FinanceArlRiskClass[] = ["I", "II", "III", "IV", "V"];

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
  transportAidEligible: true,
  employerHealthContributionApplies: true,
  arlRiskClass: "I" as FinanceArlRiskClass,
  active: true,
};

const emptyEntryForm = {
  salary: "",
  extras: "",
  deductions: "",
  benefits: "",
  dayOvertimeHours: "",
  nightOvertimeHours: "",
  nightSurchargeHours: "",
  restDayDayHours: "",
  restDayNightHours: "",
  otherDeductions: "",
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
  const [receiptEntry, setReceiptEntry] = useState<FinancePayrollEntry | null>(null);
  const [showCostReport, setShowCostReport] = useState(false);
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
  const editingEntry = period?.entries.find((entry) => entry.id === editingEntryId) ?? null;
  const editingAutomaticEntry = editingEntry?.calculationVersion === AUTOMATIC_CALCULATION_VERSION;

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
      transportAidEligible: employee.transportAidEligible,
      employerHealthContributionApplies: employee.employerHealthContributionApplies,
      arlRiskClass: employee.arlRiskClass,
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
        transportAidEligible: employeeForm.transportAidEligible,
        employerHealthContributionApplies: employeeForm.employerHealthContributionApplies,
        arlRiskClass: employeeForm.arlRiskClass,
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
      dayOvertimeHours: String(entry.dayOvertimeHours),
      nightOvertimeHours: String(entry.nightOvertimeHours),
      nightSurchargeHours: String(entry.nightSurchargeHours),
      restDayDayHours: String(entry.restDayDayHours),
      restDayNightHours: String(entry.restDayNightHours),
      otherDeductions: String(entry.otherDeductions),
      note: entry.note ?? "",
    });
    setError("");
  }

  async function saveEntry(event: FormEvent) {
    event.preventDefault();
    if (!editingEntryId) return;
    const editingEntry = period?.entries.find((entry) => entry.id === editingEntryId);
    if (!editingEntry) return;

    const automatic = editingEntry.calculationVersion === AUTOMATIC_CALCULATION_VERSION;
    const automaticValues = [
      Number(entryForm.dayOvertimeHours),
      Number(entryForm.nightOvertimeHours),
      Number(entryForm.nightSurchargeHours),
      Number(entryForm.restDayDayHours),
      Number(entryForm.restDayNightHours),
      Number(entryForm.otherDeductions),
    ];
    const legacyValues = [
      Number(entryForm.salary),
      Number(entryForm.extras),
      Number(entryForm.deductions),
      Number(entryForm.benefits),
    ];
    const values = automatic ? automaticValues : legacyValues;
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      setError(automatic
        ? "Las horas y otros descuentos deben ser números mayores o iguales a 0."
        : "Los valores de la línea deben ser números mayores o iguales a 0.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await updateFinancePayrollEntry(editingEntryId, automatic ? {
        dayOvertimeHours: automaticValues[0],
        nightOvertimeHours: automaticValues[1],
        nightSurchargeHours: automaticValues[2],
        restDayDayHours: automaticValues[3],
        restDayNightHours: automaticValues[4],
        otherDeductions: automaticValues[5],
        note: entryForm.note.trim() || null,
      } : {
        salary: legacyValues[0],
        extras: legacyValues[1],
        deductions: legacyValues[2],
        benefits: legacyValues[3],
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
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  aria-label="Aplica auxilio de transporte"
                  checked={employeeForm.transportAidEligible}
                  onChange={(event) => setEmployeeForm((current) => ({
                    ...current,
                    transportAidEligible: event.target.checked,
                  }))}
                />
                Puede recibir auxilio de transporte
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  aria-label="Aplica aporte patronal de salud"
                  checked={employeeForm.employerHealthContributionApplies}
                  onChange={(event) => setEmployeeForm((current) => ({
                    ...current,
                    employerHealthContributionApplies: event.target.checked,
                  }))}
                />
                Aplica aporte patronal de salud (8,5%)
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Clase de riesgo ARL
                <select
                  aria-label="Clase de riesgo ARL"
                  value={employeeForm.arlRiskClass}
                  onChange={(event) => setEmployeeForm((current) => ({
                    ...current,
                    arlRiskClass: event.target.value as FinanceArlRiskClass,
                  }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                >
                  {arlRiskClasses.map((riskClass) => (
                    <option key={riskClass} value={riskClass}>Clase {riskClass}</option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-gray-500">
                  Selecciona la clase asignada al trabajador o actividad. Este MVP no la determina automáticamente.
                </span>
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
              {editingAutomaticEntry
                ? "Ingresa las horas y otros descuentos. Los importes son calculados por el servidor."
                : "Línea histórica: conserva el ajuste manual de salario, extras, deducciones y prestaciones."}
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {editingAutomaticEntry ? (
                <>
                  <HoursInput label="Horas extra diurnas" value={entryForm.dayOvertimeHours} onChange={(value) => setEntryForm((current) => ({ ...current, dayOvertimeHours: value }))} />
                  <HoursInput label="Horas extra nocturnas" value={entryForm.nightOvertimeHours} onChange={(value) => setEntryForm((current) => ({ ...current, nightOvertimeHours: value }))} />
                  <HoursInput label="Horas con recargo nocturno" value={entryForm.nightSurchargeHours} onChange={(value) => setEntryForm((current) => ({ ...current, nightSurchargeHours: value }))} />
                  <HoursInput label="Horas dominicales/festivas diurnas" value={entryForm.restDayDayHours} onChange={(value) => setEntryForm((current) => ({ ...current, restDayDayHours: value }))} />
                  <HoursInput label="Horas dominicales/festivas nocturnas" value={entryForm.restDayNightHours} onChange={(value) => setEntryForm((current) => ({ ...current, restDayNightHours: value }))} />
                  <HoursInput label="Otros descuentos" value={entryForm.otherDeductions} money onChange={(value) => setEntryForm((current) => ({ ...current, otherDeductions: value }))} />
                  {editingEntry && <PayrollBreakdown entry={editingEntry} />}
                </>
              ) : (
                <>
                  <LegacyMoneyInput label="Salario del periodo" value={entryForm.salary} onChange={(value) => setEntryForm((current) => ({ ...current, salary: value }))} />
                  <LegacyMoneyInput label="Extras" value={entryForm.extras} onChange={(value) => setEntryForm((current) => ({ ...current, extras: value }))} />
                  <LegacyMoneyInput label="Deducciones" value={entryForm.deductions} onChange={(value) => setEntryForm((current) => ({ ...current, deductions: value }))} />
                  <LegacyMoneyInput label="Prestaciones" value={entryForm.benefits} onChange={(value) => setEntryForm((current) => ({ ...current, benefits: value }))} />
                </>
              )}
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
                <h2 className="text-lg font-semibold text-[#001F3F]">Resumen general del período</h2>
                {period && (
                  <Button type="button" variant="secondary" onClick={() => setShowCostReport(true)}>
                    Informe de costos
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["Número de empleados", String(period?.totals.employeeCount ?? 0)],
                  ["Total salarios", formatCurrency(period?.totals.salaries ?? 0)],
                  ["Extras y recargos", formatCurrency(period?.totals.extras ?? 0)],
                  ["Auxilio de transporte", formatCurrency(period?.totals.transportAid ?? 0)],
                  ["Total devengado", formatCurrency(period?.totals.totalAccrued ?? 0)],
                  ["Salud trabajador", formatCurrency(period?.totals.healthDeduction ?? 0)],
                  ["Pensión trabajador", formatCurrency(period?.totals.pensionDeduction ?? 0)],
                  ["Otros descuentos", formatCurrency(period?.totals.otherDeductions ?? 0)],
                  ["Total deducciones", formatCurrency(period?.totals.totalDeductions ?? 0)],
                  ["Total seguridad social a girar", formatCurrency(period?.totals.totalSocialSecurityPayment ?? 0)],
                  ["Aportes adicionales empresa", formatCurrency(period?.totals.employerSocialSecurityCost ?? 0)],
                  ["Salida inmediata de nómina", formatCurrency(period?.totals.immediatePayrollCashOutflow ?? 0)],
                  ["Total provisiones prestacionales", formatCurrency(period?.totals.benefits ?? 0)],
                  ["Costo estimado total del restaurante", formatCurrency(period?.totals.employerCost ?? 0)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl bg-[#001F3F] p-5 text-white">
                <p className="text-sm font-semibold uppercase tracking-wide">Neto total de nómina</p>
                <p className="mt-1 text-3xl font-bold">{formatCurrency(period?.totals.net ?? 0)}</p>
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
                      <th className="py-2 pr-3">Auxilio</th>
                      <th className="py-2 pr-3">Devengado</th>
                      <th className="py-2 pr-3">Deducciones</th>
                      <th className="py-2 pr-3">Provisiones prestacionales</th>
                      <th className="py-2 pr-3">Neto</th>
                      <th className="py-2 pr-3">Costo estimado restaurante</th>
                      <th className="py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!period || period.entries.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-gray-500">
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
                          <td className="py-2 pr-3">{formatCurrency(entry.transportAid)}</td>
                          <td className="py-2 pr-3">{formatCurrency(entry.totalAccrued)}</td>
                          <td className="py-2 pr-3">{formatCurrency(entry.totalDeductions)}</td>
                          <td className="py-2 pr-3">{formatCurrency(entry.benefits)}</td>
                          <td className="py-2 pr-3">{formatCurrency(entry.net)}</td>
                          <td className="py-2 pr-3">{formatCurrency(entry.employerCost)}</td>
                          <td className="space-x-3 py-2 whitespace-nowrap">
                            <button type="button" className="text-sm text-[#001F3F] hover:underline" onClick={() => setReceiptEntry(entry)}>
                              Comprobante
                            </button>
                            {canUpdate && isOpen && (
                              <>
                              <button type="button" className="text-sm text-blue-700 hover:underline" onClick={() => openEditEntry(entry)}>
                                Ajustar
                              </button>
                              <button type="button" className="text-sm text-red-700 hover:underline" onClick={() => void removeEntry(entry)}>
                                Quitar
                              </button>
                              </>
                            )}
                          </td>
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
                      <th className="py-2 pr-3">Aportes empresa</th>
                      <th className="py-2 pr-3">Provisiones prestacionales</th>
                      <th className="py-2 pr-3">Costo estimado restaurante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(period?.byArea ?? []).map((row) => (
                      <tr key={row.area} className="border-b border-gray-100">
                        <td className="py-2 pr-3 font-semibold">{areaLabels[row.area]}</td>
                        <td className="py-2 pr-3">{row.employeeCount}</td>
                        <td className="py-2 pr-3">{formatCurrency(row.salaries)}</td>
                        <td className="py-2 pr-3">{formatCurrency(row.employerSocialSecurityCost)}</td>
                        <td className="py-2 pr-3">{formatCurrency(row.benefits)}</td>
                        <td className="py-2 pr-3">{formatCurrency(row.total)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="py-2 pr-3 font-semibold">Total</td>
                      <td className="py-2 pr-3">{period?.totals.employeeCount ?? 0}</td>
                      <td className="py-2 pr-3">{formatCurrency(period?.totals.salaries ?? 0)}</td>
                      <td className="py-2 pr-3">{formatCurrency(period?.totals.employerSocialSecurityCost ?? 0)}</td>
                      <td className="py-2 pr-3">{formatCurrency(period?.totals.benefits ?? 0)}</td>
                      <td className="py-2 pr-3">{formatCurrency(period?.totals.employerCost ?? 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
        {receiptEntry && (
          <PayrollReceipt
            month={period?.month ?? month}
            entry={receiptEntry}
            areaLabel={areaLabels[receiptEntry.area]}
            onClose={() => setReceiptEntry(null)}
          />
        )}
        {showCostReport && period && (
          <PayrollCostReport
            period={period}
            areaLabels={areaLabels}
            onClose={() => setShowCostReport(false)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function HoursInput({
  label,
  value,
  money = false,
  onChange,
}: {
  label: string;
  value: string;
  money?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-gray-700">
      {label}
      <input
        required
        aria-label={label}
        type="number"
        min="0"
        step={money ? "0.01" : "0.01"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
      />
    </label>
  );
}

function LegacyMoneyInput({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold text-gray-700">
      {label}
      <input
        required
        aria-label={label}
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
      />
    </label>
  );
}

function PayrollBreakdown({ entry }: { entry: FinancePayrollEntry }) {
  const payrollRows = [
    ["Salario", entry.salary],
    ["Valor hora ordinaria", entry.ordinaryHourlyRate],
    ["Horas extra diurnas", entry.dayOvertimePay],
    ["Horas extra nocturnas", entry.nightOvertimePay],
    ["Recargo nocturno", entry.nightSurchargePay],
    ["Dominical/festivo diurno", entry.restDayDayPay],
    ["Dominical/festivo nocturno", entry.restDayNightPay],
    ["Auxilio transporte", entry.transportAid],
    ["Total devengado", entry.totalAccrued],
    ["Salud", entry.healthDeduction],
    ["Pensión", entry.pensionDeduction],
    ["Otros descuentos", entry.otherDeductions],
    ["Total deducciones", entry.totalDeductions],
    ["Neto a pagar", entry.net],
  ] as const;
  const socialSecurityRows = [
    ["IBC seguridad social", entry.contributionBase],
    ["Salud trabajador 4%", entry.employeeHealthDeduction],
    ["Salud empresa 8,5%", entry.employerHealthContribution],
    ["Total salud", entry.totalHealthContribution],
    ["Pensión trabajador 4%", entry.employeePensionDeduction],
    ["Pensión empresa 12%", entry.employerPensionContribution],
    ["Total pensión", entry.totalPensionContribution],
    [`ARL clase ${entry.arlRiskClass} (${(entry.arlRate * 100).toLocaleString("es-CO", { maximumFractionDigits: 3 })}%)`, entry.employerArlContribution],
    ["Total seguridad social a girar", entry.totalSocialSecurityPayment],
    ["Aportes adicionales empresa", entry.employerSocialSecurityCost],
    ["Salida inmediata de nómina", entry.immediatePayrollCashOutflow],
  ] as const;
  const provisionRows = [
    ["Prima de servicios", entry.primaProvision],
    ["Cesantías", entry.severanceProvision],
    ["Intereses de cesantías", entry.severanceInterestProvision],
    ["Vacaciones", entry.vacationProvision],
    ["Total provisiones", entry.benefits],
    ["Costo estimado para el restaurante", entry.employerCost],
  ] as const;

  return (
    <section className="rounded-xl border border-blue-100 bg-blue-50 p-4 md:col-span-2" aria-label="Desglose calculado">
      <h3 className="font-semibold text-[#001F3F]">Desglose calculado por backend</h3>
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {payrollRows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 border-b border-blue-100 py-1">
            <dt>{label}</dt>
            <dd className="font-semibold tabular-nums">{formatCurrency(value)}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-5 font-semibold text-[#001F3F]">SEGURIDAD SOCIAL</h3>
      <p className="mt-1 text-xs text-slate-600">
        El total a girar incluye los descuentos del trabajador y los aportes adicionales de la empresa.
      </p>
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {socialSecurityRows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 border-b border-blue-100 py-1">
            <dt>{label}</dt>
            <dd className="font-semibold tabular-nums">{formatCurrency(value)}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-5 font-semibold text-[#001F3F]">PROVISIONES PRESTACIONALES</h3>
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {provisionRows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 border-b border-blue-100 py-1">
            <dt>{label}</dt>
            <dd className="font-semibold tabular-nums">{formatCurrency(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
