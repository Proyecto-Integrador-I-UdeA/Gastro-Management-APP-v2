"use client";

import { useCallback, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import {
  useManualMovementActions,
  useManualMovementReferences,
  useManualMovementsList,
  useManualMovementSummary,
} from '@/hooks/useManualMovements';
import MovementSummaryCards from '@/components/finance/movements/MovementSummaryCards';
import MovementFilters from '@/components/finance/movements/MovementFilters';
import MovementTable from '@/components/finance/movements/MovementTable';
import MovementForm from '@/components/finance/movements/MovementForm';
import DatePresets from '@/components/finance/profitability/DatePresets';
import { todayInBogota } from '@/utils/finance/dateRanges';
import type {
  CreateManualMovementInput,
  ListManualMovementsQuery,
  ManualMovement,
  MovementKind,
} from '@/types/finance/manualMovement';

function firstOfMonth(ymd: string) {
  return `${ymd.slice(0, 7)}-01`;
}

export default function FinanceMovementsPage() {
  useAuthGuard('accounting.read');

  const today = todayInBogota();
  const [from, setFrom] = useState(firstOfMonth(today));
  const [to, setTo] = useState(today);
  const [kind, setKind] = useState<'' | MovementKind>('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ManualMovement | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const references = useManualMovementReferences();
  const summary = useManualMovementSummary(today);

  const listQuery: ListManualMovementsQuery = useMemo(() => ({
    from,
    to,
    kind: kind || undefined,
    paymentMethodId: paymentMethodId ? Number(paymentMethodId) : undefined,
    search: search.trim() || undefined,
  }), [from, to, kind, paymentMethodId, search]);

  const list = useManualMovementsList(listQuery);
  const actions = useManualMovementActions();

  const refreshAll = useCallback(() => {
    list.refresh();
    summary.refresh();
    references.refresh();
  }, [list, summary, references]);

  const handleCreate = useCallback(async (input: CreateManualMovementInput) => {
    await actions.create(input);
    setFormOpen(false);
    refreshAll();
  }, [actions, refreshAll]);

  const handleConfirm = useCallback(async (movement: ManualMovement) => {
    if (!window.confirm(`¿Confirmar el movimiento "${movement.concept}" por ${movement.amount}?`)) return;
    try {
      await actions.confirm(movement.id);
      refreshAll();
    } catch {
      // error ya seteado en actions.error
    }
  }, [actions, refreshAll]);

  const handleCancel = useCallback(async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) return;
    await actions.cancel(cancelTarget.id, cancelReason.trim());
    setCancelTarget(null);
    setCancelReason('');
    refreshAll();
  }, [actions, cancelTarget, cancelReason, refreshAll]);

  const handleFilterChange = useCallback((patch: Partial<{
    from: string;
    to: string;
    kind: '' | MovementKind;
    paymentMethodId: string;
    search: string;
  }>) => {
    if (patch.from !== undefined) setFrom(patch.from);
    if (patch.to !== undefined) setTo(patch.to);
    if (patch.kind !== undefined) setKind(patch.kind);
    if (patch.paymentMethodId !== undefined) setPaymentMethodId(patch.paymentMethodId);
    if (patch.search !== undefined) setSearch(patch.search);
  }, []);

  const handleApplyPreset = useCallback((range: { from: string; to: string }) => {
    setFrom(range.from);
    setTo(range.to);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-5 p-4 sm:p-6">
        <header className="rounded-2xl bg-gradient-to-r from-[#001F3F] to-[#1b4770] p-6 text-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-blue-100">Finanzas</p>
              <h1 className="mt-1 text-3xl font-bold">Movimientos de tesorería</h1>
              <p className="mt-2 max-w-2xl text-blue-100">
                Registrá ingresos y egresos manuales con concepto, tercero, tipo, medio y valor.
                Las ventas POS se suman automáticamente como ingreso de caja.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#001F3F] shadow-sm transition hover:bg-blue-50"
            >
              + Nuevo movimiento
            </button>
          </div>
        </header>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Rangos rápidos</h2>
          <div className="mt-2">
            <DatePresets from={from} to={to} onApply={handleApplyPreset} />
          </div>
        </section>

        {summary.loading && (
          <p className="rounded-xl bg-white p-5 text-slate-600 shadow-sm">Cargando resumen…</p>
        )}
        {summary.error && (
          <p role="alert" className="rounded-xl bg-red-50 p-5 text-red-800">{summary.error}</p>
        )}
        {!summary.loading && !summary.error && summary.data && (
          <MovementSummaryCards data={summary.data} posSales={summary.posSales} />
        )}

        <MovementFilters
          from={from}
          to={to}
          kind={kind}
          paymentMethodId={paymentMethodId}
          search={search}
          paymentMethods={references.data?.paymentMethods ?? []}
          onChange={handleFilterChange}
        />

        <MovementTable
          movements={list.data}
          loading={list.loading}
          error={list.error}
          onCancel={movement => setCancelTarget(movement)}
          onConfirm={handleConfirm}
        />
      </div>

      <MovementForm
        open={formOpen}
        counterparties={references.data?.counterparties ?? []}
        paymentMethods={references.data?.paymentMethods ?? []}
        submitting={actions.submitting}
        serverError={actions.error}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
      />

      {cancelTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-[#001F3F]">Cancelar movimiento</h2>
            <p className="mt-2 text-sm text-slate-600">
              Vas a cancelar <strong>{cancelTarget.concept}</strong> por{' '}
              <strong>{cancelTarget.amount}</strong>. El saldo del medio se revertirá.
            </p>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Motivo *
              <input
                type="text"
                maxLength={500}
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
                placeholder="Ej: Error de captura, duplicado"
              />
            </label>
            {actions.error && (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                {actions.error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setCancelTarget(null); setCancelReason(''); }}
                disabled={actions.submitting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={actions.submitting || !cancelReason.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {actions.submitting ? 'Cancelando…' : 'Confirmar cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}