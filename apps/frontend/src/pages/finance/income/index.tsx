"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useIncomeComparison } from '@/hooks/useIncomeSummary';
import IncomeFilters from '@/components/finance/income/IncomeFilters';
import IncomeSummaryCards from '@/components/finance/income/IncomeSummaryCards';
import IncomeTrendChart from '@/components/finance/income/IncomeTrendChart';
import DatePresets from '@/components/finance/income/DatePresets';
import { downloadIncomeCsv } from '@/utils/finance/exportIncomeCsv';
import {
  dateRangePresets,
  todayInBogota,
} from '@/utils/finance/dateRanges';
import type {
  IncomeGranularity,
  IncomeRecognition,
  IncomeCurrencySummary,
} from '@/types/finance/income';

const RECOGNITION_VALUES: IncomeRecognition[] = ['accrual', 'cash'];
const GRANULARITY_VALUES: IncomeGranularity[] = ['day', 'week', 'month', 'year'];

function parseInitialState(query: Record<string, string | string[] | undefined>) {
  const today = todayInBogota();
  const defaults = dateRangePresets.mesActual(today);

  const rawFrom = typeof query.from === 'string' ? query.from : defaults.from;
  const rawTo = typeof query.to === 'string' ? query.to : defaults.to;

  const from = /^\d{4}-\d{2}-\d{2}$/.test(rawFrom) ? rawFrom : defaults.from;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(rawTo) ? rawTo : defaults.to;

  const recognition: IncomeRecognition =
    typeof query.recognition === 'string' &&
    (RECOGNITION_VALUES as string[]).includes(query.recognition)
      ? (query.recognition as IncomeRecognition)
      : 'accrual';

  const granularity: IncomeGranularity =
    typeof query.granularity === 'string' &&
    (GRANULARITY_VALUES as string[]).includes(query.granularity)
      ? (query.granularity as IncomeGranularity)
      : 'day';

  const includeService = query.includeService === 'true';

  return { from, to, recognition, granularity, includeService };
}

export default function FinanceIncomePage() {
  useAuthGuard('accounting.read');
  const router = useRouter();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [recognition, setRecognition] = useState<IncomeRecognition>('accrual');
  const [granularity, setGranularity] = useState<IncomeGranularity>('day');
  const [includeService, setIncludeService] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!router.isReady || hydrated) return;
    const init = parseInitialState(router.query);
    setFrom(init.from);
    setTo(init.to);
    setRecognition(init.recognition);
    setGranularity(init.granularity);
    setIncludeService(init.includeService);
    setHydrated(true);
  }, [router.isReady, router.query, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const nextQuery: Record<string, string> = {
      from,
      to,
      recognition,
      granularity,
      ...(includeService ? { includeService: 'true' } : {}),
    };
    const currentQuery = router.query as Record<string, string | string[] | undefined>;
    const isSame =
      currentQuery.from === nextQuery.from &&
      currentQuery.to === nextQuery.to &&
      currentQuery.recognition === nextQuery.recognition &&
      currentQuery.granularity === nextQuery.granularity &&
      (currentQuery.includeService ?? undefined) === nextQuery.includeService;
    if (isSame) return;
    void router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
  }, [hydrated, from, to, recognition, granularity, includeService, router]);

  const query = useMemo(
    () => ({ from, to, recognition, granularity, includeService }),
    [from, to, recognition, granularity, includeService],
  );

  const { current, previous, loading, error } = useIncomeComparison(query);

  const handleFilterChange = useCallback((patch: Partial<typeof query>) => {
    if (patch.from !== undefined) setFrom(patch.from);
    if (patch.to !== undefined) setTo(patch.to);
    if (patch.recognition !== undefined) setRecognition(patch.recognition);
    if (patch.granularity !== undefined) setGranularity(patch.granularity);
    if (patch.includeService !== undefined) setIncludeService(patch.includeService);
  }, []);

  const handleApplyPreset = useCallback((range: { from: string; to: string }) => {
    setFrom(range.from);
    setTo(range.to);
  }, []);

  const previousCurrencies = useMemo(() => {
    const map = new Map<string, IncomeCurrencySummary>();
    if (previous) {
      for (const c of previous.currencies) map.set(c.currency, c);
    }
    return map;
  }, [previous]);

  const handleExport = useCallback(() => {
    if (current) downloadIncomeCsv(current);
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
              <h1 className="mt-1 text-3xl font-bold">Ingresos</h1>
              <p className="mt-2 max-w-2xl text-blue-100">
                Consulta los ingresos por periodo con comparación contra el período anterior.
              </p>
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

        <IncomeFilters
          from={from}
          to={to}
          recognition={recognition}
          granularity={granularity}
          includeService={includeService}
          onChange={handleFilterChange}
        />

        {loading && (
          <p className="rounded-xl bg-white p-5 text-slate-600 shadow-sm">Cargando ingresos…</p>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-5 text-red-800">{error}</p>
        )}

        {!loading && !error && current && current.currencies.length === 0 && (
          <p className="rounded-xl bg-white p-5 text-slate-600 shadow-sm">
            No hay ingresos registrados para el periodo seleccionado.
          </p>
        )}

        {!loading && !error && current && current.currencies.map(currency => (
          <div key={currency.currency} className="space-y-4">
            <IncomeSummaryCards
              data={currency}
              previous={previousCurrencies.get(currency.currency) ?? null}
            />
            <IncomeTrendChart
              buckets={currency.buckets}
              currency={currency.currency}
              granularity={current.period.granularity}
            />
            {currency.byPaymentMethod && (
              <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h2 className="text-xl font-bold text-[#001F3F]">Por método de pago · {currency.currency}</h2>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {Object.entries(currency.byPaymentMethod).map(([method, amount]) => (
                    <li key={method} className="rounded-lg border border-slate-200 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{method}</p>
                      <p className="mt-1 text-lg font-bold text-[#001F3F]">{amount}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}