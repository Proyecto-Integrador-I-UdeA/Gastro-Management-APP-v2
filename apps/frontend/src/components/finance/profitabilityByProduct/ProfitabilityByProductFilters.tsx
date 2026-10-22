import type { CategoryProfitability } from '@/types/finance/profitabilityByProduct';

type Props = {
  from: string;
  to: string;
  categoryId: string;
  search: string;
  categories: CategoryProfitability[];
  onChange: (patch: Partial<{
    from: string;
    to: string;
    categoryId: string;
    search: string;
  }>) => void;
};

export default function ProfitabilityByProductFilters({
  from,
  to,
  categoryId,
  search,
  categories,
  onChange,
}: Props) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-bold text-[#001F3F]">Filtros</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-semibold text-slate-700">
          Desde
          <input
            aria-label="Desde"
            type="date"
            value={from}
            onChange={event => onChange({ from: event.target.value })}
            className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Hasta
          <input
            aria-label="Hasta"
            type="date"
            value={to}
            onChange={event => onChange({ to: event.target.value })}
            className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Categoría
          <select
            aria-label="Categoría"
            value={categoryId}
            onChange={event => onChange({ categoryId: event.target.value })}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2"
          >
            <option value="">Todas</option>
            {categories.map(c => (
              <option key={`${c.categoryId ?? 'null'}`} value={c.categoryId ?? ''} disabled={c.categoryId === null}>
                {c.categoryName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Buscar producto
          <input
            aria-label="Buscar producto"
            type="search"
            value={search}
            onChange={event => onChange({ search: event.target.value })}
            placeholder="Ej: Milanesa, Ensalada"
            className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
          />
        </label>
      </div>
    </section>
  );
}