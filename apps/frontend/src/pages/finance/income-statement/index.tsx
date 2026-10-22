"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useIncomeStatementComparison } from '@/hooks/useIncomeStatement';
import IncomeStatementFilters from '@/components/finance/incomeStatement/IncomeStatementFilters';
import PnlTable from '@/components/finance/incomeStatement/PnlTable';
import KpiCards from '@/components/finance/incomeStatement/KpiCards';
import AdvancedKpis from '@/components/finance/incomeStatement/AdvancedKpis';
import CashBreakdown from '@/components/finance/incomeStatement/CashBreakdown';
import IncomeStatementTrendChart from '@/components/finance/incomeStatement/IncomeStatementTrendChart';
import DatePresets from '@/components/finance/profitability/DatePresets';
import { downloadIncomeStatementCsv } from '@/utils/finance/exportIncomeStatementCsv';
import { dateRangePresets, todayInBogota } from '@/utils/finance/dateRanges';
import type {
  IncomeStatementCurrencySummary,
  IncomeStatementGranularity,
  IncomeStatementSummaryQuery,
} from '@/types/finance/incomeStatement';

const GRANULARITY_VALUES: IncomeStatementGranularity[] = ['month', 'year'];

function parseInitialState(query: Record<string, string | string[] | undefined>) {
  const today = todayInBogota();
  const defaults = dateRangePresets.mesActual(today);

  const rawFrom = typeof query.from === 'string' ? query.from : defaults.from;
  const rawTo = typeof query.to === 'string' ? query.to : defaults.to;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(rawFrom) ? rawFrom : defaults.from;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(rawTo) ? rawTo : defaults.to;

  const granularity: IncomeStatementGranularity =
    typeof query.granularity === 'string' &&
    (GRANULARITY_VALUES as string[]).includes(query.granularity)
      ? (query.granularity as IncomeStatementGranularity)
      : 'month';

  return { from, to, granularity };
}

export default function FinanceIncomeStatementPage() {
  useAuthGuard('accounting.read');
  const router = useRouter();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [granularity, setGranularity] = useState<IncomeStatementGranularity>('month');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!router.isReady || hydrated) return;
    const init = parseInitialState(router.query);
    setFrom(init.from);
    setTo(init.to);
    setGranularity(init.granularity);
    setHydrated(true);
  }, [router.isReady, router.query, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const nextQuery: Record<string, string> = { from, to, granularity };
    const currentQuery = router.query as Record<string, string | string[] | undefined>;
    const isSame =
      currentQuery.from === nextQuery.from &&
      currentQuery.to === nextQuery.to &&
      currentQuery.granularity === nextQuery.granularity;
    if (isSame) return;
    void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
  }, [hydrated, from, to, granularity, router]);

  const query: IncomeStatementSummaryQuery = useMemo(
    () => ({ from, to, granularity }),
    [from, to, granularity],
  );

  const { current, previous, loading, error } = useIncomeStatementComparison(query);

  const handleFilterChange = useCallback((patch: Partial<IncomeStatementSummaryQuery>) => {
    if (patch.from !== undefined) setFrom(patch.from);
    if (patch.to !== undefined) setTo(patch.to);
    if (patch.granularity !== undefined) setGranularity(patch.granularity);
  }, []);

  const handleApplyPreset = useCallback((range: { from: string; to: string }) => {
    setFrom(range.from);
    setTo(range.to);
  }, []);

  const previousCurrencies = useMemo(() => {
    const map = new Map<string, IncomeStatementCurrencySummary>();
    if (previous) {
      for (const c of previous.currencies) map.set(c.currency, c);
    }
    return map;
  }, [previous]);

  const handleExport = useCallback(() => {
    if (current) downloadIncomeStatementCsv(current);
  }, [current]);

  if (!hydrated) {
    return (
      <DashboardLayout>
        <div className="p-6 text-slate-600">Cargando…</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5 p-4 sm:p-6">
        <header className="rounded-2xl bg-gradient-to-r from-[#001F3F] to-[#1b4770] p-6 text-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-blue-100">Finanzas</p>
              <h1 className="mt-1 text-3xl font-bold">Estado de resultados</h1>
              <p className="mt-2 max-w-2xl text-blue-100">
                P&amp;L jerárquico del período con 24 indicadores financieros y operativos, comparación contra período anterior.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
  <a
    href="/finance/dashboard"
    className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/20"
  >
    ← Ver dashboard financiero
  </a>
</div>
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={!current || current.currencies.length === 0}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#001F3F] shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Exportar CSV
            </button>
          </div>
        </header>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Rangos rápidos</h2>
          <div className="mt-2">
            <DatePresets from={from} to={to} onApply={handleApplyPreset} />
          </div>
        </section>

        <IncomeStatementFilters
          from={from}
          to={to}
          granularity={granularity}
          onChange={handleFilterChange}
        />

        {loading && (
          <p className="rounded-xl bg-white p-5 text-slate-600 shadow-sm">Cargando estado de resultados…</p>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-5 text-red-800">{error}</p>
        )}

        {!loading && !error && current && current.currencies.length === 0 && (
          <p className="rounded-xl bg-white p-5 text-slate-600 shadow-sm">
            No hay datos para el período seleccionado.
          </p>
        )}

        {!loading && !error && current && current.currencies.map(currency => (
          <div key={currency.currency} className="space-y-4">
            <KpiCards
              data={currency}
              previous={previousCurrencies.get(currency.currency) ?? null}
            />
            <PnlTable data={currency} />
            <CashBreakdown data={currency} />
            <AdvancedKpis data={currency} />
            <IncomeStatementTrendChart
              buckets={currency.buckets}
              currency={currency.currency}
              granularity={current.period.granularity}
            />
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}