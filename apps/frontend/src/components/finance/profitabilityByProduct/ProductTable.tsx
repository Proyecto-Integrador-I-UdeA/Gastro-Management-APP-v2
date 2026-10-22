import type { ProductProfitability } from '@/types/finance/profitabilityByProduct';

type Props = {
  products: ProductProfitability[];
  currency: string;
  targetFoodCostPct: string;
};

function money(value: string | number, currency = 'COP') {
  const safe = /^[A-Z]{3}$/.test(currency) ? currency : 'COP';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: safe,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function pct(value: string) {
  return `${Number(value ?? 0).toFixed(2)}%`;
}

function foodCostClass(value: string, target: string): string {
  const n = Number(value);
  const t = Number(target);
  if (n <= t) return 'text-emerald-700 font-semibold';
  if (n <= t + 10) return 'text-amber-700 font-semibold';
  return 'text-red-700 font-semibold';
}

export default function ProductTable({ products, currency, targetFoodCostPct }: Props) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[#001F3F]">Margen por producto · {currency}</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {products.length} productos
        </span>
      </div>
      {products.length === 0 ? (
        <p className="mt-3 text-slate-600">No hay productos vendidos en el período.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-600">
                <th className="p-2">Producto</th>
                <th className="p-2">Categoría</th>
                <th className="p-2 text-right">Unidades</th>
                <th className="p-2 text-right">Pedidos</th>
                <th className="p-2 text-right">Ingresos</th>
                <th className="p-2 text-right">COGS</th>
                <th className="p-2 text-right">Utilidad bruta</th>
                <th className="p-2 text-right">Margen %</th>
                <th className="p-2 text-right">Food cost %</th>
                <th className="p-2 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.menuItemId} className="border-b last:border-0">
                  <td className="p-2 font-medium text-slate-800">{p.menuItemName}</td>
                  <td className="p-2 text-slate-600">{p.categoryName ?? '—'}</td>
                  <td className="p-2 text-right">{p.unitsSold}</td>
                  <td className="p-2 text-right">{p.orderCount}</td>
                  <td className="p-2 text-right">{money(p.revenue, currency)}</td>
                  <td className="p-2 text-right">{money(p.cogsTheoretical, currency)}</td>
                  <td className="p-2 text-right">{money(p.grossProfit, currency)}</td>
                  <td className="p-2 text-right">{pct(p.grossMarginPct)}</td>
                  <td className={`p-2 text-right ${foodCostClass(p.foodCostPct, targetFoodCostPct)}`}>
                    {pct(p.foodCostPct)}
                  </td>
                  <td className="p-2 text-center">
                    {p.isBelowTarget ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800" title="Food cost por encima del objetivo">
                        Bajo objetivo
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">
        COGS calculado como costo teórico según recetas. La merma real se analiza en{' '}
        <a href="/finance/profitability" className="font-semibold underline">Rentabilidad</a>.
      </p>
    </section>
  );
}