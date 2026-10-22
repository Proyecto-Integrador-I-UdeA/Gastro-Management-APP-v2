import type { CategoryProfitability } from '@/types/finance/profitabilityByProduct';

type Props = {
  categories: CategoryProfitability[];
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

export default function CategoryTable({ categories, currency, targetFoodCostPct }: Props) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-xl font-bold text-[#001F3F]">Margen por categoría · {currency}</h2>
      {categories.length === 0 ? (
        <p className="mt-3 text-slate-600">No hay datos para el período.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-600">
                <th className="p-2">Categoría</th>
                <th className="p-2 text-right">Productos</th>
                <th className="p-2 text-right">Unidades</th>
                <th className="p-2 text-right">Ingresos</th>
                <th className="p-2 text-right">COGS</th>
                <th className="p-2 text-right">Utilidad bruta</th>
                <th className="p-2 text-right">Margen %</th>
                <th className="p-2 text-right">Food cost %</th>
                <th className="p-2 text-right">Bajo objetivo</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(c => (
                <tr key={`${c.categoryId ?? 'null'}`} className="border-b last:border-0">
                  <td className="p-2 font-medium text-slate-800">{c.categoryName}</td>
                  <td className="p-2 text-right">{c.productCount}</td>
                  <td className="p-2 text-right">{c.unitsSold}</td>
                  <td className="p-2 text-right">{money(c.revenue, currency)}</td>
                  <td className="p-2 text-right">{money(c.cogsTheoretical, currency)}</td>
                  <td className="p-2 text-right">{money(c.grossProfit, currency)}</td>
                  <td className="p-2 text-right">{pct(c.grossMarginPct)}</td>
                  <td className={`p-2 text-right ${foodCostClass(c.foodCostPct, targetFoodCostPct)}`}>
                    {pct(c.foodCostPct)}
                  </td>
                  <td className="p-2 text-right">
                    {c.productsBelowTarget > 0 ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        {c.productsBelowTarget}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}