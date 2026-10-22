"use client";

import { useCallback, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import {
  useTransferActions,
  useTransferReferences,
  useTransfersList,
} from '@/hooks/useTransfers';
import TransferSummaryCards from '@/components/finance/transfers/TransferSummaryCards';
import TransferFilters from '@/components/finance/transfers/TransferFilters';
import TransferTable from '@/components/finance/transfers/TransferTable';
import TransferForm from '@/components/finance/transfers/TransferForm';
import DatePresets from '@/components/finance/profitability/DatePresets';
import { todayInBogota } from '@/utils/finance/dateRanges';
import type {
  CreateTransferInput,
  ListTransfersQuery,
} from '@/types/finance/transfer';

function firstOfMonth(ymd: string) {
  return `${ymd.slice(0, 7)}-01`;
}

export default function FinanceTransfersPage() {
  useAuthGuard('accounting.read');

  const today = todayInBogota();
  const [from, setFrom] = useState(firstOfMonth(today));
  const [to, setTo] = useState(today);
  const [sourceMethodId, setSourceMethodId] = useState('');
  const [targetMethodId, setTargetMethodId] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const references = useTransferReferences();

  const listQuery: ListTransfersQuery = useMemo(() => ({
    from,
    to,
    sourceMethodId: sourceMethodId ? Number(sourceMethodId) : undefined,
    targetMethodId: targetMethodId ? Number(targetMethodId) : undefined,
    search: search.trim() || undefined,
  }), [from, to, sourceMethodId, targetMethodId, search]);

  const list = useTransfersList(listQuery);
  const actions = useTransferActions();

  const refreshAll = useCallback(() => {
    list.refresh();
    references.refresh();
  }, [list, references]);

  const handleCreate = useCallback(async (input: CreateTransferInput) => {
    await actions.create(input);
    setFormOpen(false);
    refreshAll();
  }, [actions, refreshAll]);

  const handleFilterChange = useCallback((patch: Partial<{
    from: string;
    to: string;
    sourceMethodId: string;
    targetMethodId: string;
    search: string;
  }>) => {
    if (patch.from !== undefined) setFrom(patch.from);
    if (patch.to !== undefined) setTo(patch.to);
    if (patch.sourceMethodId !== undefined) setSourceMethodId(patch.sourceMethodId);
    if (patch.targetMethodId !== undefined) setTargetMethodId(patch.targetMethodId);
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
              <h1 className="mt-1 text-3xl font-bold">Transferencias entre medios</h1>
              <p className="mt-2 max-w-2xl text-blue-100">
                Trasladá dinero entre caja, bancos y pasarelas para cuadrar tesorería.
                La resta en el origen y la suma en el destino son atómicas.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#001F3F] shadow-sm transition hover:bg-blue-50"
            >
              + Nueva transferencia
            </button>
          </div>
        </header>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Rangos rápidos</h2>
          <div className="mt-2">
            <DatePresets from={from} to={to} onApply={handleApplyPreset} />
          </div>
        </section>

        <TransferSummaryCards
          methods={references.data?.paymentMethods ?? []}
          loading={references.loading}
          error={references.error}
        />

        <TransferFilters
          from={from}
          to={to}
          sourceMethodId={sourceMethodId}
          targetMethodId={targetMethodId}
          search={search}
          paymentMethods={references.data?.paymentMethods ?? []}
          onChange={handleFilterChange}
        />

        <TransferTable
          transfers={list.data}
          loading={list.loading}
          error={list.error}
        />
      </div>

      <TransferForm
        open={formOpen}
        paymentMethods={references.data?.paymentMethods ?? []}
        submitting={actions.submitting}
        serverError={actions.error}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
      />
    </DashboardLayout>
  );
}