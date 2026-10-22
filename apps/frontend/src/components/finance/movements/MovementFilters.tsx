import type { MovementKind } from '@/types/finance/manualMovement';
import type { PaymentMethodRef } from '@/types/finance/manualMovement';

type Props = {
  from: string;
  to: string;
  kind: '' | MovementKind;
  paymentMethodId: string;
  search: string;
  paymentMethods: PaymentMethodRef[];
  onChange: (patch: Partial<{
    from: string;
    to: string;
    kind: '' | MovementKind;
    paymentMethodId: string;
    search: string;
  }>) => void;
};

export default function MovementFilters({
  from,
  to,
  kind,
  paymentMethodId,
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
          Tipo
          <select
            aria-label="Tipo"
            value={kind}
            onChange={event => onChange({ kind: event.target.value as '' | MovementKind })}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2"
          >
            <option value="">Todos</option>
            <option value="INCOME">Ingresos</option>
            <option value="EXPENSE">Egresos</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Medio de pago
          <select
            aria-label="Medio de pago"
            value={paymentMethodId}
            onChange={event => onChange({ paymentMethodId: event.target.value })}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2"
          >
            <option value="">Todos</option>
            {paymentMethods.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
          Buscar (concepto, tercero o documento)
          <input
            aria-label="Buscar"
            type="search"
            placeholder="Ej: alquiler, proveedor, FAC-001"
            value={search}
            onChange={event => onChange({ search: event.target.value })}
            className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
          />
        </label>
      </div>
    </section>
  );
}