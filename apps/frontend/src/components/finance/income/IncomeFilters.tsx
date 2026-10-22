import type { IncomeGranularity, IncomeRecognition } from '@/types/finance/income';

type Props = {
  from: string;
  to: string;
  recognition: IncomeRecognition;
  granularity: IncomeGranularity;
  includeService: boolean;
  onChange: (patch: Partial<{
    from: string;
    to: string;
    recognition: IncomeRecognition;
    granularity: IncomeGranularity;
    includeService: boolean;
  }>) => void;
};

const granularityLabels: Record<IncomeGranularity, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
  year: 'Año',
};

export default function IncomeFilters({
  from,
  to,
  recognition,
  granularity,
  includeService,
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
          Reconocimiento
          <select
            aria-label="Reconocimiento"
            value={recognition}
            onChange={event => onChange({ recognition: event.target.value as IncomeRecognition })}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2"
          >
            <option value="accrual">Devengo (orden cerrada)</option>
            <option value="cash">Caja (pago recibido)</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Agrupación
          <select
            aria-label="Agrupación"
            value={granularity}
            onChange={event => onChange({ granularity: event.target.value as IncomeGranularity })}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2"
          >
            {(Object.keys(granularityLabels) as IncomeGranularity[]).map(value => (
              <option key={value} value={value}>{granularityLabels[value]}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={includeService}
          onChange={event => onChange({ includeService: event.target.checked })}
          className="h-4 w-4 rounded border-slate-300"
        />
        Incluir servicio voluntario como ingreso operativo
      </label>
    </section>
  );
}