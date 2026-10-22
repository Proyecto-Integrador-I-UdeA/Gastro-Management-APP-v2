"use client";

import { useCallback, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useProfitabilityByProduct } from '@/hooks/useProfitabilityByProduct';
import ProfitabilityByProductFilters from '@/components/finance/profitabilityByProduct/ProfitabilityByProductFilters';
import ExecutiveCards from '@/components/finance/profitabilityByProduct/ExecutiveCards';
import CategoryTable from '@/components/finance/profitabilityByProduct/CategoryTable';
import ProductTable from '@/components/finance/profitabilityByProduct/ProductTable';
import DatePresets from '@/components/finance/profitability/DatePresets';
import { todayInBogota } from '@/utils/finance/dateRanges';
import type { ProfitabilityByProductQuery } from '@/types/finance/profitabilityByProduct';

function firstOfMonth(ymd: string) {
  return `${ymd.slice(0, 7)}-01`;
}

export default function FinanceProfitabilityByProductPage() {
  useAuthGuard('accounting.read');

  const today = todayInBogota();
  const [from, setFrom] = useState(firstOfMonth(today));
  const [to, setTo] = useState(today);
  const [categoryId, setCategoryId] = useState('');
  const [search, setSearch] = useState('');

  const query: ProfitabilityByProductQuery = {
    from,
    to,
    categoryId: categoryId ? Number(categoryId) : undefined,
    search: search.trim() || undefined,
  };
  const { data, loading, error } = useProfitabilityByProduct(query);

  const handleFilterChange = useCallback((patch: Partial<{
    from: string;
    to: string;
    categoryId: string;
    search: string;
  }>) => {
    if (patch.from !== undefined) setFrom(patch.from);
    if (patch.to !== undefined) setTo(patch.to);
    if (patch.categoryId !== undefined) setCategoryId(patch.categoryId);
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
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-100">Finanzas · Rentabilidad</p>
          <h1 className="mt-1 text-3xl font-bold">Margen por producto</h1>
          <p className="mt-2 max-w-2xl text-blue-100">
            Identificá qué productos generan valor y cuáles están bajo objetivo.
            COGS teórico según recetas; merma real en Rentabilidad agregada.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/finance/profitability"
              className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/20"
            >
              ← Volver a Rentabilidad
            </a>
            <a
              href="/sales/analytics"
              className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/20"
            >
              Ver analítica de ventas →
            </a>
          </div>
        </header>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Rangos rápidos</h2>
          <div className="mt-2">
            <DatePresets from={from} to={to} onApply={handleApplyPreset} />
          </div>
        </section>

        <ProfitabilityByProductFilters
          from={from}
          to={to}
          categoryId={categoryId}
          search={search}
          categories={data?.categories ?? []}
          onChange={handleFilterChange}
        />

        {loading && (
          <p className="rounded-xl bg-white p-5 text-slate-600 shadow-sm">Cargando rentabilidad por producto…</p>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-5 text-red-800">{error}</p>
        )}

        {!loading && !error && data && data.totals.totalProducts === 0 && (
          <p className="rounded-xl bg-white p-5 text-slate-600 shadow-sm">
            No hay ventas en el período seleccionado.
          </p>
        )}

        {!loading && !error && data && data.totals.totalProducts > 0 && (
          <>
            <ExecutiveCards data={data} />
            <CategoryTable
              categories={data.categories}
              currency={data.totals.currency}
              targetFoodCostPct={data.targets.foodCostTargetPct}
            />
            <ProductTable
              products={data.products}
              currency={data.totals.currency}
              targetFoodCostPct={data.targets.foodCostTargetPct}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}