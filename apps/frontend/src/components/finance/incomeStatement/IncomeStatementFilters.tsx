import type { IncomeStatementGranularity } from '@/types/finance/incomeStatement';

type Props = {
  from: string;
  to: string;
  granularity: IncomeStatementGranularity;
  onChange: (patch: Partial<{
    from: string;
    to: string;
    granularity: IncomeStatementGranularity;
  }>) => void;
};

export default function IncomeStatementFilters({ from, to, granularity, onChange }: Props) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-bold text-[#001F3F]">Filtros</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
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
          Agrupación
          <select
            aria-label="Agrupación"
            value={granularity}
            onChange={event => onChange({ granularity: event.target.value as IncomeStatementGranularity })}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2"
          >
            <option value="month">Mes</option>
            <option value="year">Año</option>
          </select>
        </label>
      </div>
    </section>
  );
}