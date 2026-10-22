import type { Transfer } from '@/types/finance/transfer';

type Props = {
  transfers: Transfer[];
  loading: boolean;
  error: string;
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

export default function TransferTable({ transfers, loading, error }: Props) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[#001F3F]">Transferencias</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {transfers.length} registros
        </span>
      </div>

      {loading && <p className="mt-3 text-slate-600">Cargando transferencias…</p>}
      {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}

      {!loading && !error && transfers.length === 0 && (
        <p className="mt-3 text-slate-600">No hay transferencias para los filtros seleccionados.</p>
      )}

      {!loading && !error && transfers.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-600">
                <th className="p-2">Fecha</th>
                <th className="p-2">Descripción</th>
                <th className="p-2">Origen</th>
                <th className="p-2">Destino</th>
                <th className="p-2">Doc.</th>
                <th className="p-2 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map(t => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="p-2 whitespace-nowrap">{dateLabel(t.occurredAt)}</td>
                  <td className="p-2 max-w-[280px] truncate" title={t.description}>
                    {t.description}
                  </td>
                  <td className="p-2 text-slate-600">
                    <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                      {t.sourceMethod?.name ?? '—'}
                    </span>
                  </td>
                  <td className="p-2 text-slate-600">
                    <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                      {t.targetMethod?.name ?? '—'}
                    </span>
                  </td>
                  <td className="p-2 text-slate-500 text-xs">{t.documentNumber ?? '—'}</td>
                  <td className="p-2 text-right font-semibold text-[#001F3F]">
                    {money(t.amount, t.currency)}
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