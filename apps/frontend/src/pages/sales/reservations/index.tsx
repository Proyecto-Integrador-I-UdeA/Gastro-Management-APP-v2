"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { formatReservationDate, formatReservationTime } from '@/lib/reservations';
import type { Reservation, ReservationStatus, ReservationSummary } from '@/types/reservations';
import { reservationStatusLabels } from '@/types/reservations';
import { apiFetch } from '@/utils/apiFetch';
import { getUserPermissions } from '@/utils/permissions';

const statusClasses: Record<ReservationStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
};

const emptySummary: ReservationSummary = {
  todayReservations: 0, committedTables: 0, upcomingEvents: 0, expectedGuests: 0, generatedAt: '',
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function ReservationsPage() {
  const router = useRouter();
  const [permissionReady, setPermissionReady] = useState(false);
  const [canRead, setCanRead] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [summary, setSummary] = useState<ReservationSummary>(emptySummary);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  useEffect(() => {
    const permissions = getUserPermissions();
    setCanRead(permissions.includes('reservations.read'));
    setCanManage(permissions.includes('reservations.manage'));
    setPermissionReady(true);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const query = appliedSearch ? `?search=${encodeURIComponent(appliedSearch)}` : '';
      const [list, kpis] = await Promise.all([
        apiFetch<{ reservations: Reservation[] }>(`/sales/reservations${query}`),
        apiFetch<ReservationSummary>('/sales/reservations/summary'),
      ]);
      setReservations(list.reservations);
      setSummary(kpis);
    } catch (error) {
      setPageError(errorMessage(error, 'No fue posible cargar las reservas.'));
    } finally {
      setLoading(false);
    }
  }, [appliedSearch]);

  useEffect(() => {
    if (permissionReady && canRead) void load();
  }, [canRead, load, permissionReady]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setAppliedSearch(search.trim());
  }

  function openReservation(id: number) {
    void router.push(`/sales/reservations/${id}`);
  }

  function rowKey(event: KeyboardEvent<HTMLTableRowElement>, id: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openReservation(id);
    }
  }

  if (!permissionReady) return <DashboardLayout><div className="p-8 text-slate-600">Cargando reservas...</div></DashboardLayout>;
  if (!canRead) return <DashboardLayout><div className="m-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">No tienes permiso para consultar reservas y eventos.</div></DashboardLayout>;

  const kpis = [
    ['Reservas de hoy', summary.todayReservations, 'border-blue-400 bg-blue-50 text-blue-900'],
    ['Mesas comprometidas', summary.committedTables, 'border-violet-400 bg-violet-50 text-violet-900'],
    ['Eventos próximos', summary.upcomingEvents, 'border-amber-400 bg-amber-50 text-amber-900'],
    ['Comensales esperados', summary.expectedGuests, 'border-emerald-400 bg-emerald-50 text-emerald-900'],
  ] as const;

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Ventas / Relación y seguimiento</p>
            <h1 className="mt-1 text-3xl font-bold text-[#001F3F]">Reservas y eventos</h1>
            <p className="mt-2 text-slate-600">Programa reservas, organiza mesas y administra eventos del restaurante.</p>
          </div>
          {canManage && <button type="button" onClick={() => void router.push('/sales/reservations/new')} className="rounded-lg bg-[#001F3F] px-5 py-3 font-semibold text-white shadow-sm">+ Crear reserva</button>}
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map(([label, value, classes]) => <article key={label} className={`rounded-2xl border-l-4 p-5 shadow-sm ${classes}`}><p className="text-sm font-semibold">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></article>)}
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <form className="mb-5 flex flex-col gap-3 sm:flex-row" onSubmit={submitSearch}>
            <input aria-label="Buscar reservas" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar cliente, fecha o evento..." className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3" />
            <button type="submit" className="rounded-xl border border-[#001F3F] px-5 py-3 font-semibold text-[#001F3F]">Buscar</button>
            {appliedSearch && <button type="button" onClick={() => { setSearch(''); setAppliedSearch(''); }} className="rounded-xl px-4 py-3 font-semibold text-slate-600">Limpiar</button>}
          </form>

          {pageError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{pageError}<button type="button" onClick={() => void load()} className="ml-3 underline">Reintentar</button></div>}
          {!pageError && loading && <div className="py-12 text-center text-slate-600">Cargando reservas...</div>}
          {!pageError && !loading && reservations.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-600">{appliedSearch ? 'No se encontraron reservas.' : 'No hay reservas registradas.'}</div>}
          {!pageError && !loading && reservations.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead><tr className="border-b text-slate-600"><th className="p-3">Cliente</th><th className="p-3">Fecha</th><th className="p-3">Hora</th><th className="p-3">Personas</th><th className="p-3">Motivo</th><th className="p-3">Estado</th></tr></thead>
                <tbody>{reservations.map(reservation => (
                  <tr key={reservation.id} tabIndex={0} onClick={() => openReservation(reservation.id)} onKeyDown={event => rowKey(event, reservation.id)} className="cursor-pointer border-b transition hover:bg-slate-50 focus:bg-blue-50 focus:outline-none">
                    <td className="p-3 font-semibold text-slate-900">{reservation.customerName}{reservation.isVip && <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-900">VIP</span>}</td>
                    <td className="p-3">{formatReservationDate(reservation.scheduledAt)}</td>
                    <td className="p-3">{formatReservationTime(reservation.scheduledAt)}</td>
                    <td className="p-3">{reservation.guestCount}</td>
                    <td className="max-w-xs truncate p-3">{reservation.reason}</td>
                    <td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[reservation.status]}`}>{reservationStatusLabels[reservation.status]}</span>{reservation.lateCancellation && <span className="ml-2 text-xs font-semibold text-red-700">Cancelación tardía</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
