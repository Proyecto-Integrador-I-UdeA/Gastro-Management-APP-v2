"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Button from "@/components/Button";
import { getApiErrorMessage } from "@/lib/apiError";
import {
  createFinanceLedger,
  createFinanceLedgerPayment,
  deleteFinanceLedger,
  fetchFinanceLedger,
  updateFinanceLedger,
  type FinanceLedgerDocument,
  type FinanceLedgerResponse,
  type FinanceLedgerSide,
  type FinanceLedgerStatus,
} from "@/lib/financeLedgerApi";

const statusLabels: Record<FinanceLedgerStatus, string> = {
  PAID: "Pagada / cobrada",
  OVERDUE: "Vencida",
  UPCOMING: "Próxima",
  PENDING: "Pendiente",
};

const statusClasses: Record<FinanceLedgerStatus, string> = {
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
  UPCOMING: "bg-orange-100 text-orange-800",
  PENDING: "bg-blue-100 text-blue-800",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

const emptyForm = {
  supplierId: "",
  partyName: "",
  invoiceNumber: "",
  issuedAt: "",
  dueAt: "",
  amount: "",
};

export default function FinanceLedgerSection({
  month,
  canUpdate,
}: {
  month: string;
  canUpdate: boolean;
}) {
  const [data, setData] = useState<FinanceLedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formSide, setFormSide] = useState<FinanceLedgerSide | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [assignedDocument, setAssignedDocument] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchFinanceLedger(month));
    } catch (cause) {
      setError(getApiErrorMessage(cause, "No se pudieron cargar las cuentas"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate(side: FinanceLedgerSide) {
    setFormSide(side);
    setEditingId(null);
    setPayingId(null);
    setForm(emptyForm);
    setAssignedDocument("");
    setError("");
  }

  function openEdit(item: FinanceLedgerDocument) {
    setFormSide(item.side);
    setEditingId(item.id);
    setPayingId(null);
    setForm({
      supplierId: item.supplierId ? String(item.supplierId) : "",
      partyName: item.partyName ?? "",
      invoiceNumber: item.invoiceNumber ?? "",
      issuedAt: item.issuedAt,
      dueAt: item.dueAt,
      amount: String(item.amount),
    });
    setAssignedDocument(item.documentNumber);
    setError("");
  }

  function closeForm() {
    setFormSide(null);
    setEditingId(null);
    setForm(emptyForm);
    setAssignedDocument("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!formSide) return;
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("El valor del documento debe ser mayor a 0.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const invoiceNumber = form.invoiceNumber.trim();
      const datesAndAmount = {
        issuedAt: form.issuedAt,
        dueAt: form.dueAt,
        amount,
      };
      if (editingId) {
        await updateFinanceLedger(editingId, {
          ...datesAndAmount,
          ...(formSide === "PAYABLE"
            ? {
                supplierId: Number(form.supplierId),
                invoiceNumber: invoiceNumber || null,
              }
            : { partyName: form.partyName.trim() }),
        });
      } else {
        await createFinanceLedger({
          side: formSide,
          ...datesAndAmount,
          ...(formSide === "PAYABLE"
            ? {
                supplierId: Number(form.supplierId),
                ...(invoiceNumber ? { invoiceNumber } : {}),
              }
            : { partyName: form.partyName.trim(), supplierId: null }),
        });
      }
      closeForm();
      await load();
    } catch (cause) {
      setError(getApiErrorMessage(cause, "No se pudo guardar el documento"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: FinanceLedgerDocument) {
    if (!confirm(`¿Eliminar el documento "${item.documentNumber}"?`)) return;
    setError("");
    try {
      await deleteFinanceLedger(item.id);
      if (editingId === item.id) closeForm();
      await load();
    } catch (cause) {
      setError(getApiErrorMessage(cause, "No se pudo eliminar el documento"));
    }
  }

  async function registerPayment(event: FormEvent) {
    event.preventDefault();
    if (!payingId) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("El abono debe ser mayor a 0.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createFinanceLedgerPayment(payingId, amount);
      setPayingId(null);
      setPaymentAmount("");
      await load();
    } catch (cause) {
      setError(getApiErrorMessage(cause, "No se pudo registrar el abono"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-2 space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-[#001F3F]">Cuentas por pagar y por cobrar</h2>
        <p className="mt-1 text-sm text-gray-600">
          Documentos con vencimiento en el periodo seleccionado. El estado se calcula con el saldo y la fecha.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          {error}
        </div>
      )}

      {formSide && canUpdate && (
        <form onSubmit={save} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[#001F3F]">
            {editingId ? "Editar documento" : "Nuevo documento"} · {formSide === "PAYABLE" ? "Cuenta por pagar" : "Cuenta por cobrar"}
          </h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-semibold text-gray-700">
              Documento interno
              <input
                readOnly
                aria-label="Documento interno"
                value={assignedDocument || (formSide === "PAYABLE" ? "FC-#####" : "FV-#####")}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-gray-600"
              />
            </label>
            {formSide === "PAYABLE" ? (
              <label className="block text-sm font-semibold text-gray-700">
                Proveedor
                <select
                  required
                  aria-label="Proveedor"
                  value={form.supplierId}
                  onChange={(event) => setForm((current) => ({ ...current, supplierId: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                >
                  <option value="">Selecciona un proveedor</option>
                  {(data?.suppliers ?? []).map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="block text-sm font-semibold text-gray-700">
                Cliente
                <input
                  required
                  aria-label="Cliente"
                  value={form.partyName}
                  onChange={(event) => setForm((current) => ({ ...current, partyName: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                />
              </label>
            )}
            {formSide === "PAYABLE" && (
              <label className="block text-sm font-semibold text-gray-700">
                Código de factura
                <input
                  aria-label="Código de factura"
                  value={form.invoiceNumber}
                  onChange={(event) => setForm((current) => ({ ...current, invoiceNumber: event.target.value }))}
                  placeholder="Opcional · factura del proveedor"
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
                />
                <span className="mt-1 block text-xs font-normal text-gray-500">
                  Número que trajo el proveedor, si aplica.
                </span>
              </label>
            )}
            <label className="block text-sm font-semibold text-gray-700">
              Emisión
              <input
                required
                aria-label="Emisión"
                type="date"
                value={form.issuedAt}
                onChange={(event) => setForm((current) => ({ ...current, issuedAt: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-semibold text-gray-700">
              Vencimiento
              <input
                required
                aria-label="Vencimiento"
                type="date"
                value={form.dueAt}
                onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-semibold text-gray-700 md:col-span-2">
              Valor
              <input
                required
                aria-label="Valor del documento"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
              />
            </label>
          </div>
          <div className="mt-4 flex gap-3">
            <Button type="submit" disabled={saving}>
              {editingId ? "Actualizar documento" : "Guardar documento"}
            </Button>
            <Button type="button" variant="secondary" onClick={closeForm}>Cancelar</Button>
          </div>
        </form>
      )}

      {payingId && canUpdate && (
        <form onSubmit={registerPayment} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-[#001F3F]">Registrar abono</h3>
          <label className="mt-4 block max-w-xs text-sm font-semibold text-gray-700">
            Valor del abono
            <input
              required
              aria-label="Valor del abono"
              type="number"
              min="0.01"
              step="0.01"
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2"
            />
          </label>
          <div className="mt-4 flex gap-3">
            <Button type="submit" disabled={saving}>Guardar abono</Button>
            <Button type="button" variant="secondary" onClick={() => { setPayingId(null); setPaymentAmount(""); }}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="rounded-xl bg-white p-6 text-gray-600 shadow-sm">Cargando cuentas…</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <LedgerTable
            title="Cuentas por pagar"
            partyLabel="Proveedor"
            emptyLabel="No hay cuentas por pagar con vencimiento en este periodo."
            rows={data?.payables ?? []}
            canUpdate={canUpdate}
            onAdd={() => openCreate("PAYABLE")}
            onEdit={openEdit}
            onDelete={remove}
            onPay={(item) => { setPayingId(item.id); setPaymentAmount(""); closeForm(); }}
          />
          <LedgerTable
            title="Cuentas por cobrar"
            partyLabel="Cliente"
            emptyLabel="No hay cuentas por cobrar con vencimiento en este periodo."
            rows={data?.receivables ?? []}
            canUpdate={canUpdate}
            onAdd={() => openCreate("RECEIVABLE")}
            onEdit={openEdit}
            onDelete={remove}
            onPay={(item) => { setPayingId(item.id); setPaymentAmount(""); closeForm(); }}
          />
        </div>
      )}
    </div>
  );
}

function LedgerTable({
  title,
  partyLabel,
  emptyLabel,
  rows,
  canUpdate,
  onAdd,
  onEdit,
  onDelete,
  onPay,
}: {
  title: string;
  partyLabel: string;
  emptyLabel: string;
  rows: FinanceLedgerDocument[];
  canUpdate: boolean;
  onAdd: () => void;
  onEdit: (item: FinanceLedgerDocument) => void;
  onDelete: (item: FinanceLedgerDocument) => void;
  onPay: (item: FinanceLedgerDocument) => void;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[#001F3F]">{title}</h3>
        {canUpdate && <Button type="button" onClick={onAdd}>+ Agregar</Button>}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b text-left text-gray-500">
            <tr>
              <th className="py-2 pr-3">{partyLabel}</th>
              <th className="py-2 pr-3">Documento</th>
              <th className="py-2 pr-3">Factura</th>
              <th className="py-2 pr-3">Vencimiento</th>
              <th className="py-2 pr-3">Saldo</th>
              <th className="py-2 pr-3">Estado</th>
              {canUpdate && <th className="py-2">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={canUpdate ? 7 : 6} className="py-8 text-center text-gray-500">{emptyLabel}</td>
              </tr>
            ) : (
              rows.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-2 pr-3 font-semibold">{item.partyName || "—"}</td>
                  <td className="py-2 pr-3">{item.documentNumber}</td>
                  <td className="py-2 pr-3">{item.invoiceNumber || "—"}</td>
                  <td className="py-2 pr-3">{item.dueAt}</td>
                  <td className="py-2 pr-3">{formatCurrency(item.balance)}</td>
                  <td className="py-2 pr-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClasses[item.status]}`}>
                      {item.status === "PAID"
                        ? (item.side === "PAYABLE" ? "Pagada" : "Cobrada")
                        : statusLabels[item.status]}
                    </span>
                  </td>
                  {canUpdate && (
                    <td className="space-x-3 py-2 whitespace-nowrap">
                      {item.balance > 0 && (
                        <button type="button" className="text-sm text-emerald-700 hover:underline" onClick={() => onPay(item)}>
                          Abonar
                        </button>
                      )}
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
    </section>
  );
}
