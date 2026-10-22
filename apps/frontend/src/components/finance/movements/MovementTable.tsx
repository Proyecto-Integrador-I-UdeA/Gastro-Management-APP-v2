import type { ManualMovement } from '@/types/finance/manualMovement';

type Props = {
  movements: ManualMovement[];
  loading: boolean;
  error: string;
  onCancel: (movement: ManualMovement) => void;
  onConfirm: (movement: ManualMovement) => void;
};

function money(value: string | number, currency = 'COP') {
  const safe = /^[A-Z]{3}$/.test(currency) ? currency : 'COP';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: safe,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function dateLabel(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).format(new Date(iso));
}

function statusColor(status: string) {
  if (status === 'POSTED') return 'bg-emerald-100 text-emerald-800';
  if (status === 'PENDING') return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

export default function MovementTable({ movements, loading, error, onCancel, onConfirm }: Props) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[#001F3F]">Movimientos</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {movements.length} registros
        </span>
      </div>

      {loading && <p className="mt-3 text-slate-600">Cargando movimientos…</p>}
      {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}

      {!loading && !error && movements.length === 0 && (
        <p className="mt-3 text-slate-600">No hay movimientos para los filtros seleccionados.</p>
      )}

      {!loading && !error && movements.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-600">
                <th className="p-2">Fecha</th>
                <th className="p-2">Tipo</th>
                <th className="p-2">Concepto</th>
                <th className="p-2">Tercero</th>
                <th className="p-2">Medio</th>
                <th className="p-2">Doc.</th>
                <th className="p-2 text-right">Monto</th>
                <th className="p-2">Estado</th>
                <th className="p-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {movements.map(m => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="p-2 whitespace-nowrap">{dateLabel(m.occurredAt)}</td>
                  <td className="p-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      m.kind === 'INCOME' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {m.kind === 'INCOME' ? 'Ingreso' : 'Egreso'}
                    </span>
                  </td>
                  <td className="p-2 max-w-[240px] truncate" title={m.concept}>{m.concept}</td>
                  <td className="p-2 text-slate-600">{m.counterparty?.name ?? '—'}</td>
                  <td className="p-2 text-slate-600">{m.paymentMethod?.name ?? '—'}</td>
                  <td className="p-2 text-slate-500 text-xs">{m.documentNumber ?? '—'}</td>
                  <td className={`p-2 text-right font-semibold ${
                    m.kind === 'INCOME' ? 'text-emerald-700' : 'text-red-700'
                  }`}>
                    {m.kind === 'INCOME' ? '+' : '−'}{money(m.amount, m.currency)}
                  </td>
                  <td className="p-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(m.status)}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex justify-end gap-1">
                      {m.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => onConfirm(m)}
                          className="rounded-lg border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                        >
                          Confirmar
                        </button>
                      )}
                      {m.status === 'POSTED' && (
                        <button
                          type="button"
                          onClick={() => onCancel(m)}
                          className="rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
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