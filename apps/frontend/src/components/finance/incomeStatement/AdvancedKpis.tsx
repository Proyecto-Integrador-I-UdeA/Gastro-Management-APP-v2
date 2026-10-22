import type { IncomeStatementCurrencySummary } from '@/types/finance/incomeStatement';

type Props = {
  data: IncomeStatementCurrencySummary;
};

function money(value: string | number, currency = 'COP') {
  const safe = /^[A-Z]{3}$/.test(currency) ? currency : 'COP';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: safe,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function pct(value: string | null) {
  if (value === null) return 'N/A';
  return `${Number(value).toFixed(2)}%`;
}

export default function AdvancedKpis({ data }: Props) {
  const { kpis } = data;
  const currency = data.currency;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <details className="group">
        <summary className="cursor-pointer list-none">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-[#001F3F]">Indicadores avanzados</h2>
            <span className="text-xs text-slate-500 group-open:hidden">▼ Ver detalle</span>
            <span className="hidden text-xs text-slate-500 group-open:inline">▲ Ocultar</span>
          </div>
        </summary>

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Estructura de costos */}
          <div className="rounded-xl border border-slate-200 p-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Estructura de costos
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              <li className="flex justify-between"><span className="text-slate-600">Labor cost</span><span className="font-semibold">{pct(kpis.costStructure.laborCostPct)}</span></li>
              <li className="flex justify-between"><span className="text-slate-600">Rent cost</span><span className="font-semibold">{pct(kpis.costStructure.rentCostPct)}</span></li>
              <li className="flex justify-between"><span className="text-slate-600">Variable cost</span><span className="font-semibold">{pct(kpis.costStructure.variableCostPct)}</span></li>
              <li className="flex justify-between"><span className="text-slate-600">Total cost</span><span className="font-semibold">{pct(kpis.costStructure.totalCostPct)}</span></li>
            </ul>
          </div>

          {/* Break-even */}
          <div className="rounded-xl border border-slate-200 p-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Punto de equilibrio
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              <li className="flex justify-between"><span className="text-slate-600">Break-even revenue</span><span className="font-semibold">{money(kpis.breakEven.revenue, currency)}</span></li>
              <li className="flex justify-between"><span className="text-slate-600">Break-even pedidos</span><span className="font-semibold">{kpis.breakEven.orders}</span></li>
              <li className="flex justify-between"><span className="text-slate-600">Margen de seguridad</span><span className="font-semibold">{pct(kpis.breakEven.marginOfSafetyPct)}</span></li>
            </ul>
          </div>

          {/* Volumen */}
          <div className="rounded-xl border border-slate-200 p-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Volumen & comensales
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              <li className="flex justify-between"><span className="text-slate-600">Pedidos</span><span className="font-semibold">{kpis.volume.orderCount}</span></li>
              <li className="flex justify-between"><span className="text-slate-600">Unidades vendidas</span><span className="font-semibold">{kpis.volume.unitsSold}</span></li>
              <li className="flex justify-between"><span className="text-slate-600">Comensales</span><span className="font-semibold">{kpis.volume.hasGuestData ? kpis.volume.totalGuests : 'Sin datos'}</span></li>
              {kpis.volume.hasGuestData && (
                <>
                  <li className="flex justify-between"><span className="text-slate-600">Comensales / pedido</span><span className="font-semibold">{kpis.volume.avgGuestsPerOrder}</span></li>
                  <li className="flex justify-between"><span className="text-slate-600">Ingreso / comensal</span><span className="font-semibold">{money(kpis.volume.revenuePerGuest, currency)}</span></li>
                </>
              )}
            </ul>
          </div>

          {/* Operaciones */}
          <div className="rounded-xl border border-slate-200 p-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Operaciones
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              <li className="flex justify-between"><span className="text-slate-600">Rotación de mesas</span><span className="font-semibold">{kpis.operations.tableTurnover}</span></li>
              <li className="flex justify-between">
                <span className="text-slate-600">Tiempo cocina (promedio)</span>
                <span className="font-semibold">
                  {kpis.operations.hasDispatchData ? `${kpis.operations.avgKitchenTimeMinutes} min` : 'Sin datos'}
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-slate-600">Reservas totales</span>
                <span className="font-semibold">{kpis.operations.totalReservations}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-slate-600">Completación reservas</span>
                <span className="font-semibold">{pct(kpis.operations.reservationCompletionRatePct)}</span>
              </li>
            </ul>
          </div>

          {/* Cash */}
          <div className="rounded-xl border border-slate-200 p-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Caja
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              <li className="flex justify-between"><span className="text-slate-600">Total cobrado</span><span className="font-semibold">{money(kpis.cash.totalCollected, currency)}</span></li>
              <li className="flex justify-between"><span className="text-slate-600">Cash ratio</span><span className="font-semibold">{pct(kpis.cash.cashRatioPct)}</span></li>
              <li className="flex justify-between">
                <span className="text-slate-600">Conciliación</span>
                <span className="font-semibold">
                  {kpis.cash.hasClosedSessions ? money(kpis.cash.cashReconciliationDifference ?? '0', currency) : 'Sin cierres'}
                </span>
              </li>
            </ul>
          </div>

          {/* Márgenes completos */}
          <div className="rounded-xl border border-slate-200 p-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Todos los márgenes
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              <li className="flex justify-between"><span className="text-slate-600">Margen bruto</span><span className="font-semibold">{pct(kpis.margins.grossMarginPct)}</span></li>
              <li className="flex justify-between"><span className="text-slate-600">Margen operativo</span><span className="font-semibold">{pct(kpis.margins.operatingMarginPct)}</span></li>
              <li className="flex justify-between"><span className="text-slate-600">Margen neto</span><span className="font-semibold">{pct(kpis.margins.netMarginPct)}</span></li>
            </ul>
          </div>
        </div>
      </details>
    </section>
  );
}