"use client";

import { useCallback, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useFinanceDashboard } from '@/hooks/useFinanceDashboard';
import LiquiditySection from '@/components/finance/dashboard/LiquiditySection';
import EfficiencySection from '@/components/finance/dashboard/EfficiencySection';
import ProfitabilitySection from '@/components/finance/dashboard/ProfitabilitySection';
import DatePresets from '@/components/finance/profitability/DatePresets';
import { todayInBogota } from '@/utils/finance/dateRanges';
import type { FinanceDashboardQuery } from '@/types/finance/financeDashboard';

function firstOfMonth(ymd: string) {
  return `${ymd.slice(0, 7)}-01`;
}

export default function FinanceDashboardPage() {
  useAuthGuard('accounting.read');

  const today = todayInBogota();
  const [from, setFrom] = useState(firstOfMonth(today));
  const [to, setTo] = useState(today);

  const query: FinanceDashboardQuery = { from, to };
  const { data, loading, error } = useFinanceDashboard(query);

  const handleApplyPreset = useCallback((range: { from: string; to: string }) => {
    setFrom(range.from);
    setTo(range.to);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-5 p-4 sm:p-6">
        <header className="rounded-2xl bg-gradient-to-r from-[#001F3F] to-[#1b4770] p-6 text-white shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-100">Finanzas</p>
          <h1 className="mt-1 text-3xl font-bold">Dashboard financiero</h1>
          <p className="mt-2 max-w-2xl text-blue-100">
            Liquidez, eficiencia y rentabilidad del período en un solo lugar.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/finance/income-statement"
              className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/20"
            >
              Ver estado de resultados →
            </a>
            <a
              href="/finance/profitability"
              className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/20"
            >
              Ver rentabilidad detallada →
            </a>
          </div>
        </header>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Rangos rápidos</h2>
          <div className="mt-2">
            <DatePresets from={from} to={to} onApply={handleApplyPreset} />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Desde
              <input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Hasta
              <input
                type="date"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
              />
            </label>
          </div>
        </section>

        {loading && (
          <p className="rounded-xl bg-white p-5 text-slate-600 shadow-sm">Cargando dashboard…</p>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-5 text-red-800">{error}</p>
        )}

        {!loading && !error && data && (
          <>
            {data.multiCurrencyDetected && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Se detectaron múltiples monedas en el período. Los indicadores de eficiencia y rentabilidad
                se muestran para <strong>{data.currency}</strong>. Revisá el{' '}
                <a href="/finance/income-statement" className="font-semibold underline">
                  estado de resultados
                </a>{' '}
                para el desglose por moneda.
              </div>
            )}

            <LiquiditySection data={data.liquidity} currency={data.currency} />
            <EfficiencySection
              data={data.efficiency}
              currency={data.currency}
              hasIncomeData={data.hasIncomeData}
            />
            <ProfitabilitySection
              data={data.profitability}
              currency={data.currency}
              hasIncomeData={data.hasIncomeData}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}