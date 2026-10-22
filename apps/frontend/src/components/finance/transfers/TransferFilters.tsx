import type { PaymentMethodRef } from '@/types/finance/transfer';

type Props = {
  from: string;
  to: string;
  sourceMethodId: string;
  targetMethodId: string;
  search: string;
  paymentMethods: PaymentMethodRef[];
  onChange: (patch: Partial<{
    from: string;
    to: string;
    sourceMethodId: string;
    targetMethodId: string;
    search: string;
  }>) => void;
};

export default function TransferFilters({
  from,
  to,
  sourceMethodId,
  targetMethodId,
  search,
  paymentMethods,
  onChange,
}: Props) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-bold text-[#001F3F]">Filtros</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          Origen
          <select
            aria-label="Origen"
            value={sourceMethodId}
            onChange={event => onChange({ sourceMethodId: event.target.value })}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2"
          >
            <option value="">Todos</option>
            {paymentMethods.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Destino
          <select
            aria-label="Destino"
            value={targetMethodId}
            onChange={event => onChange({ targetMethodId: event.target.value })}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2"
          >
            <option value="">Todos</option>
            {paymentMethods.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
          Buscar (descripción o documento)
          <input
            aria-label="Buscar"
            type="search"
            placeholder="Ej: traslado, TRF-001"
            value={search}
            onChange={event => onChange({ search: event.target.value })}
            className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
          />
        </label>
      </div>
    </section>
  );
}