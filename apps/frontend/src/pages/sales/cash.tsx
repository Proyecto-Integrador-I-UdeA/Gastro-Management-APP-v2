"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { apiFetch } from "@/utils/apiFetch";
import { getUserPermissions } from "@/utils/permissions";

type CashSession = {
  id: number;
  openingCash: string | number;
  status: "OPEN" | "CLOSED";
  cashRegister: { id: number; name: string };
  openedAt?: string;
  closedAt?: string;
  openedBy?: { fullName: string | null };
  closedBy?: { fullName: string | null };
  expectedCash?: string;
  countedCash?: string;
  difference?: string;
};

type Payment = { id: number; method: string; amount: string; change: string };
type Invoice = {
  id: number;
  subtotal: string;
  salesAmount: string;
  consumptionTaxAmount: string;
  suggestedServicePercent: string;
  serviceAccepted: boolean;
  serviceAmount: string;
  total: string;
  paid: string;
  pending: string;
  payments: Payment[];
};
type PendingOrder = {
  id: number;
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  table: { code: string };
  subtotal: string;
  salesAmount: string;
  consumptionTaxAmount: string;
  suggestedServicePercent: string;
  suggestedServiceAmount: string;
  suggestedTotal: string;
  accountRequestedAt: string | null;
  invoice: Invoice | null;
  items?: Array<{ id: number; name: string; quantity: number; subtotal: string }>;
  paid: string;
  pending: string;
};
type DailySales = {
  date: string;
  rows: Array<{ id: number; settledAt: string | null; table: string; salesAmount: string; consumptionTaxAmount: string; serviceAmount: string; totalCollected: string; payments: Array<{ method: string; amount: string }>; settledBy?: { fullName: string | null; email: string } | null }>;
  summary: { salesAmount: string; consumptionTaxAmount: string; serviceAmount: string; totalCollected: string; closedOrders: number; byMethod: Record<string, string> };
};
type CollectionSummary = { salesAmount: string; consumptionTaxAmount: string; serviceAmount: string; totalCollected: string; byMethod: Record<string, string>; expectedCash: string };
type Dashboard = { session: CashSession | null; sessionSummary?: CollectionSummary | null; config?: { servicePercent: string }; pending: PendingOrder[]; daily?: DailySales; history?: Array<CashSession & { summary: CollectionSummary }> };
type Reconciliation = { sessionId: number; openingCash: string; expectedCash: string; byMethod: Record<string, string> };
type ClosedReconciliation = { session: CashSession; byMethod: Record<string, string> };

const validAmount = (value: string, positive = false) => /^\d{1,12}(?:\.\d{1,2})?$/.test(value) && (!positive || Number(value) > 0);
const timestamp = (value?: string | null) => value ? new Date(value).toLocaleString("es-CO", { timeZone: "America/Bogota" }) : "—";

function CollectionTotals({ summary }: { summary?: CollectionSummary | null }) {
  return <div className="mt-3 grid gap-3 sm:grid-cols-3">
    <p>Ventas de productos cobradas: <strong>{money(summary?.salesAmount)}</strong></p>
    <p>Impuesto al consumo recaudado: <strong>{money(summary?.consumptionTaxAmount)}</strong></p>
    <p>Servicio voluntario recibido: <strong>{money(summary?.serviceAmount)}</strong></p>
    <p>Total recaudado: <strong>{money(summary?.totalCollected)}</strong></p>
    {["CASH", "CARD", "TRANSFER", "OTHER"].map(method => <p key={method}>{paymentLabel(method)}: <strong>{money(summary?.byMethod[method])}</strong></p>)}
  </div>;
}

function ReconciliationTotals({ openingCash, expectedCash, byMethod }: Pick<Reconciliation, "openingCash" | "expectedCash" | "byMethod">) {
  return <div className="mt-3 grid gap-3 sm:grid-cols-2">
    <p>Base inicial: <strong>{money(openingCash)}</strong></p>
    <p>Efectivo esperado: <strong>{money(expectedCash)}</strong></p>
    {["CASH", "CARD", "TRANSFER", "OTHER"].map(method => <p key={method}>{({ CASH: "Efectivo recibido", CARD: "Tarjetas registradas", TRANSFER: "Transferencias registradas", OTHER: "Otros medios" } as Record<string, string>)[method]}: <strong>{money(byMethod[method])}</strong></p>)}
  </div>;
}

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 });
}

function paymentLabel(method: string) {
  return ({ CASH: "Efectivo", CARD: "Tarjeta", TRANSFER: "Transferencia", OTHER: "Otro" } as Record<string, string>)[method] ?? method;
}

export default function CashRegisterPage() {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [selected, setSelected] = useState<PendingOrder | null>(null);
  const [openingCash, setOpeningCash] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [servicePercent, setServicePercent] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [amountTendered, setAmountTendered] = useState("");
  const [date, setDate] = useState(() => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10));
  const [documentKind, setDocumentKind] = useState<"account" | "invoice">("account");
  const [configExpanded, setConfigExpanded] = useState(false);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [closedReconciliation, setClosedReconciliation] = useState<ClosedReconciliation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);
  const paymentAttempt = useRef<{ signature: string; key: string } | null>(null);

  const canRead = permissions.includes("cash.read");
  const canOperate = permissions.includes("cash.operate");
  const canConfigure = permissions.includes("cash.configure");
  const canReports = permissions.includes("cash.reports");

  const load = useCallback(async () => {
    if (!canRead) return;
    const data = await apiFetch<Dashboard>(`/cash/dashboard?date=${date}`);
    setDashboard(data);
    if (data.config) setServicePercent(data.config.servicePercent);
    setSelected(current => current ? data.pending.find(order => order.id === current.id) ?? null : null);
  }, [canRead, date]);

  useEffect(() => {
    const current = getUserPermissions();
    setPermissions(current);
    setPermissionsLoaded(true);
  }, []);

  useEffect(() => {
    if (!canRead) return;
    void load().catch(reason => setError(reason instanceof Error ? reason.message : "No fue posible cargar Caja"));
    const timer = setInterval(() => { if (!busyRef.current) void load().catch(() => setError("No fue posible actualizar Caja")); }, 15000);
    return () => clearInterval(timer);
  }, [canRead, load]);

  const run = async (work: () => Promise<unknown>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError("");
    try { await work(); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible completar la operación"); } finally { busyRef.current = false; setBusy(false); }
  };

  const requestAccount = (order: PendingOrder) => run(async () => {
    const updated = await apiFetch<PendingOrder>(`/cash/orders/${order.id}/account`, { method: "POST", json: {} });
    setSelected(updated);
    setDocumentKind("account");
  });

  const generateInvoice = (order: PendingOrder, accepted: boolean) => {
    return run(async () => {
      const updated = await apiFetch<PendingOrder>(`/cash/orders/${order.id}/pre-invoices`, { method: "POST", json: { serviceAccepted: accepted } });
      setSelected(updated);
      setDocumentKind("invoice");
    });
  };

  const registerPayment = () => {
    if (!selected?.invoice || !dashboard?.session || !validAmount(paymentAmount, true)) return;
    const payload = { preInvoiceId: selected.invoice.id, cashSessionId: dashboard.session.id, method: paymentMethod, amount: paymentAmount, ...(paymentMethod === "CASH" ? { amountTendered: amountTendered || paymentAmount } : {}) };
    const signature = JSON.stringify(payload);
    if (paymentAttempt.current?.signature !== signature) paymentAttempt.current = { signature, key: globalThis.crypto?.randomUUID?.() ?? `cash-${Date.now()}-${Math.random().toString(36).slice(2)}` };
    const idempotencyKey = paymentAttempt.current.key;
    return run(async () => {
      await apiFetch(`/cash/payments`, { method: "POST", json: { ...payload, idempotencyKey } });
      paymentAttempt.current = null;
      setPaymentAmount("");
      setAmountTendered("");
    });
  };

  const settle = () => selected && run(async () => { await apiFetch(`/cash/orders/${selected.id}/settle`, { method: "POST", json: {} }); setSelected(null); });

  const startClosing = () => dashboard?.session && run(async () => {
    const data = await apiFetch<Reconciliation>(`/cash/session/${dashboard.session?.id}/reconciliation`);
    setReconciliation(data);
    setCountedCash("");
    setClosedReconciliation(null);
  });
  const closeSession = () => reconciliation && run(async () => {
    const session = await apiFetch<CashSession & { reconciliation: { byMethod: Record<string, string> } }>(`/cash/session/${reconciliation.sessionId}/close`, { method: "POST", json: { countedCash } });
    setClosedReconciliation({ session, byMethod: session.reconciliation.byMethod });
    setReconciliation(null);
    setCountedCash("");
  });

  const statusLabel = useMemo(() => ({ UNPAID: "Pendiente", PARTIALLY_PAID: "Pago parcial", PAID: "Pagada" } as Record<string, string>), []);

  if (!permissionsLoaded) return <DashboardLayout><p className="p-6">Cargando Caja…</p></DashboardLayout>;
  if (!canRead) return <DashboardLayout><div className="p-6"><h1 className="text-3xl font-bold text-[#001F3F]">Caja</h1><p className="mt-4 rounded bg-amber-50 p-4 text-amber-900">No tienes permiso para consultar Caja.</p></div></DashboardLayout>;

  return <DashboardLayout>
    <div className="space-y-6 p-4 sm:p-6">
      <div><h1 className="text-3xl font-bold text-[#001F3F]">Caja</h1><p className="mt-1 text-gray-600">Prefacturas, pagos y ventas del día.</p></div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      <nav aria-label="Secciones de Caja" className="flex flex-wrap gap-3">{[["session", "Sesión actual"], ["pending", "Cuentas pendientes"], ...(canReports ? [["daily", "Ventas del día"], ["history", "Historial de cajas"]] : []), ...(canConfigure ? [["config", "Configuración administrativa"]] : [])].map(([id, label]) => <a key={id} href={`#cash-${id}`} className="rounded border bg-white px-3 py-2">{label}</a>)}</nav>

      <section id="cash-session" className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">{dashboard?.session?.cashRegister.name ?? "Caja Principal"}</h2><p className="text-sm text-gray-600">{dashboard?.session ? "Abierta" : "Sin sesión abierta"}</p></div>
          {!dashboard?.session && canOperate && <div className="flex flex-wrap gap-2"><input aria-label="Base inicial" type="number" min="0" step="0.01" value={openingCash} onChange={event => setOpeningCash(event.target.value)} placeholder="Base inicial" className="w-36 rounded border p-2" /><button disabled={busy || !validAmount(openingCash)} onClick={() => run(async () => { await apiFetch("/cash/session", { method: "POST", json: { openingCash } }); setOpeningCash(""); })} className="rounded bg-[#001F3F] px-4 py-2 font-semibold text-white disabled:opacity-50">Abrir caja</button></div>}
          {dashboard?.session && canOperate && !reconciliation && <button disabled={busy} onClick={() => void startClosing()} className="rounded border border-red-700 px-4 py-2 font-semibold text-red-700 disabled:opacity-50">Cerrar caja</button>}
        </div>
        {dashboard?.session && <p className="mt-3 text-sm">Base inicial: <strong>{money(dashboard.session.openingCash)}</strong></p>}
        {dashboard?.session && <><p>Cuentas pendientes: {dashboard.pending.length}</p>{canReports && <><CollectionTotals summary={dashboard.sessionSummary} /><p className="mt-3">Efectivo esperado: <strong>{money(dashboard.sessionSummary?.expectedCash)}</strong></p></>}</>}
        {reconciliation && canOperate && <div className="mt-4 rounded-xl border p-4" role="region" aria-label="Conciliación de caja"><h3 className="font-bold">Conciliación de caja</h3><ReconciliationTotals {...reconciliation} /><div className="mt-4 flex flex-wrap gap-2"><input aria-label="Efectivo contado" type="number" min="0" step="0.01" value={countedCash} onChange={event => setCountedCash(event.target.value)} placeholder="Efectivo contado" className="w-40 rounded border p-2" /><button disabled={busy || !validAmount(countedCash)} onClick={() => void closeSession()} className="rounded bg-[#001F3F] px-4 py-2 text-white disabled:opacity-50">Confirmar cierre</button><button disabled={busy} onClick={() => { setReconciliation(null); setCountedCash(""); }} className="rounded border px-3 py-2">Cancelar cierre</button></div><p className="mt-2 text-sm text-gray-600">El efectivo esperado se recalcula al confirmar. La diferencia se informa al completar el cierre.</p></div>}
        {closedReconciliation && <div className="mt-4 rounded-xl border border-emerald-200 p-4" role="region" aria-label="Cierre realizado"><h3 className="font-bold">Cierre realizado · Sesión #{closedReconciliation.session.id}</h3><ReconciliationTotals openingCash={String(closedReconciliation.session.openingCash)} expectedCash={closedReconciliation.session.expectedCash ?? "0"} byMethod={closedReconciliation.byMethod} /><p>Efectivo contado: {money(closedReconciliation.session.countedCash)}</p><p>Diferencia: <strong>{money(closedReconciliation.session.difference)}</strong></p></div>}
      </section>

      {canConfigure && <section id="cash-config" className="rounded-2xl bg-white p-5 shadow-sm"><button aria-expanded={configExpanded} aria-controls="cash-config-form" onClick={() => setConfigExpanded(current => !current)} className="text-xl font-bold">Configuración administrativa</button>{configExpanded && <div id="cash-config-form"><p className="mt-1 text-sm text-gray-600">Servicio voluntario sugerido global (0–100 %, máximo dos decimales).</p><div className="mt-3 flex gap-2"><input aria-label="Porcentaje de servicio" type="number" min="0" max="100" step="0.01" value={servicePercent} onChange={event => setServicePercent(event.target.value)} className="w-32 rounded border p-2" /><button disabled={busy || !validAmount(servicePercent) || Number(servicePercent) > 100} onClick={() => run(async () => { await apiFetch("/cash/config/service", { method: "PUT", json: { servicePercent } }); })} className="rounded bg-[#001F3F] px-4 py-2 text-white disabled:opacity-50">Guardar porcentaje</button></div></div>}</section>}

      <section id="cash-pending" className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Cuentas pendientes</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">{dashboard?.pending.length ? dashboard.pending.map(order => <article key={order.id} className={`rounded-xl border p-4 ${selected?.id === order.id ? "border-[#001F3F] ring-2 ring-blue-100" : ""}`}>
          <h3 className="font-bold">Mesa {order.table.code} · Pedido #{order.id}</h3>
          <p className="text-sm">{order.invoice && Number(order.pending) === 0 ? "Cobertura completa · confirmar Cuenta pagada" : statusLabel[order.paymentStatus]}</p>
          <p className="text-sm text-gray-600">Venta: {money(order.salesAmount)} · Impuesto: {money(order.consumptionTaxAmount)} · Servicio sugerido: {money(order.suggestedServiceAmount)}</p>
          <p className="mt-2">Total {order.invoice ? "seleccionado" : "sugerido"}: <strong>{money(order.invoice?.total ?? order.suggestedTotal)}</strong> · Pagado: {money(order.paid)} · Pendiente: <strong>{money(order.pending)}</strong></p>
          <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy || !canOperate} onClick={() => void requestAccount(order)} className="rounded border px-3 py-2 text-sm">Generar cuenta</button><button disabled={busy || !canOperate || !order.accountRequestedAt || Boolean(order.invoice?.payments.length)} onClick={() => void generateInvoice(order, true)} className="rounded bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-50">Prefactura con servicio</button><button disabled={busy || !canOperate || !order.accountRequestedAt || Boolean(order.invoice?.payments.length)} onClick={() => void generateInvoice(order, false)} className="rounded bg-slate-700 px-3 py-2 text-sm text-white disabled:opacity-50">Prefactura sin servicio</button>{order.invoice && <button onClick={() => { setSelected(order); setDocumentKind("invoice"); }} className="rounded border px-3 py-2 text-sm">Ver cuenta y pagos</button>}</div>
        </article>) : <p className="text-gray-600">{dashboard ? "No hay cuentas pendientes." : "Cargando cuentas…"}</p>}</div>
      </section>

      {selected?.invoice && <section className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Cobro · Mesa {selected.table.code} · Pedido #{selected.id}</h2><div className="mt-3 grid gap-1 sm:grid-cols-4"><p>Venta: <strong>{money(selected.invoice.salesAmount)}</strong></p><p>Impuesto al consumo: <strong>{money(selected.invoice.consumptionTaxAmount)}</strong></p><p>Servicio: <strong>{money(selected.invoice.serviceAmount)}</strong></p><p>Total: <strong>{money(selected.invoice.total)}</strong></p></div><p className="mt-2">Pagado: {money(selected.invoice.paid)} · Pendiente: {money(selected.invoice.pending)}</p><div className="mt-4 flex flex-wrap gap-2"><select aria-label="Medio de pago" value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)} className="rounded border p-2">{["CASH", "CARD", "TRANSFER", "OTHER"].map(method => <option key={method} value={method}>{paymentLabel(method)}</option>)}</select><input aria-label="Monto del pago" type="number" min="0.01" step="0.01" value={paymentAmount} onChange={event => setPaymentAmount(event.target.value)} placeholder="Monto" className="w-32 rounded border p-2" />{paymentMethod === "CASH" && <input aria-label="Efectivo recibido" type="number" min="0" step="0.01" value={amountTendered} onChange={event => setAmountTendered(event.target.value)} placeholder="Efectivo recibido" className="w-40 rounded border p-2" />}<button disabled={busy || !canOperate || !dashboard?.session || !validAmount(paymentAmount, true) || Number(paymentAmount) > Number(selected.invoice.pending) || (paymentMethod === "CASH" && amountTendered !== "" && (!validAmount(amountTendered) || Number(amountTendered) < Number(paymentAmount)))} onClick={() => void registerPayment()} className="rounded bg-[#001F3F] px-4 py-2 text-white disabled:opacity-50">Registrar pago</button><button disabled={busy || !canOperate || Number(selected.invoice.pending) !== 0} onClick={() => void settle()} className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">Cuenta pagada</button></div>{!dashboard?.session && <p className="mt-2 text-amber-800">Abre Caja para registrar pagos.</p>}<ul className="mt-4 space-y-1 text-sm">{selected.invoice.payments.map(payment => <li key={payment.id}>{paymentLabel(payment.method)}: {money(payment.amount)}{Number(payment.change) > 0 ? ` · Cambio ${money(payment.change)}` : ""}</li>)}</ul></section>}

      {selected?.accountRequestedAt && <section id="cash-document" className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">{documentKind === "invoice" ? `Prefactura ${selected.invoice?.serviceAccepted ? "con" : "sin"} servicio` : "Cuenta inicial"} · Pedido #{selected.id}</h2><p>Mesa {selected.table.code}</p><p className="mt-2 text-sm">Documento operativo. No es factura electrónica fiscal.</p>
        <table className="mt-3 w-full text-left text-sm"><thead><tr><th>Producto</th><th>Cantidad</th><th>Subtotal</th></tr></thead><tbody>{selected.items?.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.quantity}</td><td>{money(item.subtotal)}</td></tr>)}</tbody></table>
        <p className="mt-3">Venta / consumo: {money(documentKind === "invoice" ? selected.invoice?.salesAmount : selected.salesAmount)}</p><p>Impuesto al consumo: {money(documentKind === "invoice" ? selected.invoice?.consumptionTaxAmount : selected.consumptionTaxAmount)}</p><p>{documentKind === "account" ? `Servicio sugerido ${selected.suggestedServicePercent} %` : "Servicio voluntario"}: {money(documentKind === "invoice" ? selected.invoice?.serviceAmount : selected.suggestedServiceAmount)}</p><p>Total: <strong>{money(documentKind === "invoice" ? selected.invoice?.total : selected.suggestedTotal)}</strong></p>
        {documentKind === "account" && <p className="mt-3 text-sm">El servicio es voluntario y puede aceptarse o rechazarse al momento del pago.</p>}
        <button onClick={() => window.print()} className="mt-3 rounded border px-3 py-2 print:hidden">Imprimir</button>
      </section>}

      {canReports && <section id="cash-daily" className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Ventas del día</h2>
        <input aria-label="Día de ventas" type="date" value={date} onChange={event => { if (event.target.value) setDate(event.target.value); }} className="mt-3 rounded border p-2" />
        <div className="mt-3 grid gap-3 sm:grid-cols-5"><p>Ventas de productos: <strong>{money(dashboard?.daily?.summary.salesAmount)}</strong></p><p>Impuesto al consumo: <strong>{money(dashboard?.daily?.summary.consumptionTaxAmount)}</strong></p><p>Servicio voluntario: <strong>{money(dashboard?.daily?.summary.serviceAmount)}</strong></p><p>Total recaudado: <strong>{money(dashboard?.daily?.summary.totalCollected)}</strong></p><p>Cuentas cerradas: <strong>{dashboard?.daily?.summary.closedOrders ?? 0}</strong></p></div>
        <div className="mt-3 flex flex-wrap gap-4">{Object.entries(dashboard?.daily?.summary.byMethod ?? {}).map(([method, total]) => <p key={method}>{paymentLabel(method)}: {money(total)}</p>)}</div>
        <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr>{["Hora", "Mesa / pedido", "Venta", "Impuesto al consumo", "Servicio", "Total cobrado", "Medios de pago", "Cajero"].map(title => <th key={title} className="p-2">{title}</th>)}</tr></thead><tbody>{dashboard?.daily?.rows.map(row => <tr key={row.id} className="border-b"><td className="p-2">{timestamp(row.settledAt)}</td><td className="p-2">{row.table} · #{row.id}</td><td className="p-2">{money(row.salesAmount)}</td><td className="p-2">{money(row.consumptionTaxAmount)}</td><td className="p-2">{money(row.serviceAmount)}</td><td className="p-2">{money(row.totalCollected)}</td><td className="p-2">{row.payments.map(payment => `${paymentLabel(payment.method)} ${money(payment.amount)}`).join(", ")}</td><td className="p-2">{row.settledBy?.fullName ?? row.settledBy?.email ?? "—"}</td></tr>)}</tbody></table></div>
      </section>}
      {canReports && <section id="cash-history" className="rounded-2xl bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Historial de cajas</h2>
        {!dashboard?.history?.length && <p className="mt-3">No hay sesiones cerradas.</p>}
        <div className="mt-4 space-y-4">{dashboard?.history?.map(session => <article key={session.id} className="rounded-xl border p-4"><h3 className="font-bold">{session.cashRegister.name} · Sesión #{session.id}</h3><p>Apertura: {timestamp(session.openedAt)} · {session.openedBy?.fullName ?? "—"}</p><p>Cierre: {timestamp(session.closedAt)} · {session.closedBy?.fullName ?? "—"}</p><p>Base inicial: {money(session.openingCash)}</p><CollectionTotals summary={session.summary} /><div className="mt-3 flex flex-wrap gap-4"><p>Efectivo esperado: {money(session.expectedCash)}</p><p>Efectivo contado: {money(session.countedCash)}</p><p>Diferencia: <strong>{money(session.difference)}</strong></p></div></article>)}</div>
      </section>}
      <style>{`@media print { body * { visibility: hidden; } #cash-document, #cash-document * { visibility: visible; } #cash-document { position: absolute; left: 0; top: 0; max-width: none; box-shadow: none; } }`}</style>
    </div>
  </DashboardLayout>;
}
