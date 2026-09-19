"use client";

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import ReservationForm, { ReservationFormPayload } from '@/components/reservations/ReservationForm';
import {
  bogotaLocalToIso,
  formatReservationDateTime,
} from '@/lib/reservations';
import type { Reservation, ReservationStatus, ReservationTable } from '@/types/reservations';
import {
  reservationHistoryLabels,
  reservationStatusLabels,
  reservationTypeLabels,
} from '@/types/reservations';
import { apiFetch } from '@/utils/apiFetch';
import { getUserPermissions } from '@/utils/permissions';

const statusClasses: Record<ReservationStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800', CONFIRMED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800', COMPLETED: 'bg-blue-100 text-blue-800',
};

type ActionMode = 'edit' | 'reschedule' | 'cancel' | null;

function actorName(actor: { fullName: string | null; email: string } | null | undefined) {
  return actor ? actor.fullName || actor.email : '—';
}

export default function ReservationDetailPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? Number(router.query.id) : null;
  const [permissionReady, setPermissionReady] = useState(false);
  const [canRead, setCanRead] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [tables, setTables] = useState<ReservationTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<ActionMode>(null);
  const [actionDate, setActionDate] = useState('');
  const [actionTime, setActionTime] = useState('');
  const [actionReason, setActionReason] = useState('');

  useEffect(() => {
    const permissions = getUserPermissions();
    setCanRead(permissions.includes('reservations.read'));
    setCanManage(permissions.includes('reservations.manage'));
    setPermissionReady(true);
  }, []);

  const load = useCallback(async () => {
    if (!id || !canRead) return;
    setLoading(true);
    setError('');
    try {
      const [detail, references] = await Promise.all([
        apiFetch<Reservation>(`/sales/reservations/${id}`),
        canManage
          ? apiFetch<{ tables: ReservationTable[] }>('/sales/reservations/references')
          : Promise.resolve({ tables: [] }),
      ]);
      setReservation(detail);
      setTables(references.tables);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible cargar la reserva.');
    } finally {
      setLoading(false);
    }
  }, [canManage, canRead, id]);

  useEffect(() => {
    if (permissionReady) void load();
  }, [load, permissionReady]);

  async function run(action: () => Promise<Reservation>) {
    setBusy(true);
    setError('');
    try {
      const updated = await action();
      setReservation(updated);
      setMode(null);
      setActionDate('');
      setActionTime('');
      setActionReason('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible completar la acción.');
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(payload: ReservationFormPayload) {
    await run(() => apiFetch<Reservation>(`/sales/reservations/${id}`, { method: 'PATCH', json: payload }));
  }

  function submitReschedule(event: FormEvent) {
    event.preventDefault();
    const scheduledAt = bogotaLocalToIso(actionDate, actionTime);
    if (!scheduledAt) {
      setError('Selecciona una nueva fecha y hora válidas.');
      return;
    }
    void run(() => apiFetch<Reservation>(`/sales/reservations/${id}/reschedule`, {
      method: 'POST', json: { scheduledAt, reason: actionReason.trim() || null },
    }));
  }

  function submitCancel(event: FormEvent) {
    event.preventDefault();
    if (!actionReason.trim()) {
      setError('El motivo de cancelación es obligatorio.');
      return;
    }
    void run(() => apiFetch<Reservation>(`/sales/reservations/${id}/cancel`, {
      method: 'POST', json: { reason: actionReason.trim() },
    }));
  }

  if (!permissionReady || loading) return <DashboardLayout><div className="p-8 text-slate-600">Cargando detalle de la reserva...</div></DashboardLayout>;
  if (!canRead) return <DashboardLayout><div className="m-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">No tienes permiso para consultar reservas.</div></DashboardLayout>;
  if (error && !reservation) return <DashboardLayout><div role="alert" className="m-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">{error}<button type="button" className="ml-3 underline" onClick={() => void load()}>Reintentar</button></div></DashboardLayout>;
  if (!reservation) return <DashboardLayout><div className="p-8 text-slate-600">Reserva no encontrada.</div></DashboardLayout>;

  const active = reservation.status === 'PENDING' || reservation.status === 'CONFIRMED';
  const future = new Date(reservation.scheduledAt).getTime() > Date.now();
  const readOnly = !active;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Reservas y eventos / #{reservation.id}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-[#001F3F]">{reservation.customerName}</h1>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusClasses[reservation.status]}`}>{reservationStatusLabels[reservation.status]}</span>
              {reservation.isVip && <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">VIP</span>}
              {reservation.lateCancellation && <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-800">Cancelación tardía</span>}
            </div>
          </div>
          <button type="button" onClick={() => void router.push('/sales/reservations')} className="rounded-lg border border-[#001F3F] px-4 py-2 font-semibold text-[#001F3F]">Volver a reservas</button>
        </div>

        {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}

        {mode === 'edit' ? (
          <ReservationForm initial={reservation} tables={tables} busy={busy} onSubmit={saveEdit} onCancel={() => setMode(null)} />
        ) : (
          <>
            <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Cliente / responsable" value={reservation.customerName} />
              <Info label="Teléfono" value={reservation.phone} />
              <Info label="Correo electrónico" value={reservation.email || '—'} />
              <Info label="Tipo" value={reservationTypeLabels[reservation.reservationType]} />
              <Info label="Fecha y hora" value={formatReservationDateTime(reservation.scheduledAt)} />
              <Info label="Número de personas" value={String(reservation.guestCount)} />
              <Info label="Zona preferida" value={reservation.preferredArea || '—'} />
              <Info label="Mesa preferida" value={reservation.diningTable ? `Mesa ${reservation.diningTable.code}${reservation.diningTable.area ? ` · ${reservation.diningTable.area}` : ''}` : '—'} />
              <Info label="Motivo" value={reservation.reason} />
              <Info label="Observaciones" value={reservation.notes || '—'} wide />
              <Info label="Creada por" value={`${actorName(reservation.createdBy)} · ${formatReservationDateTime(reservation.createdAt)}`} wide />
              <Info label="Última actualización" value={`${actorName(reservation.updatedBy)} · ${formatReservationDateTime(reservation.updatedAt)}`} wide />
              {reservation.cancellationReason && <Info label="Motivo de cancelación" value={reservation.cancellationReason} wide />}
            </section>

            {canManage && !readOnly && (
              <div className="mt-5 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                {future && <button type="button" onClick={() => setMode('edit')} className="rounded-lg border border-[#001F3F] px-4 py-2 font-semibold text-[#001F3F]">Editar</button>}
                {reservation.status === 'PENDING' && future && <button type="button" disabled={busy} onClick={() => void run(() => apiFetch(`/sales/reservations/${id}/confirm`, { method: 'POST', json: {} }))} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">Confirmar</button>}
                {reservation.status === 'CONFIRMED' && future && <button type="button" onClick={() => setMode('reschedule')} className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white">Aplazar</button>}
                <button type="button" onClick={() => setMode('cancel')} className="rounded-lg border border-red-600 px-4 py-2 font-semibold text-red-700">Cancelar</button>
                {reservation.status === 'CONFIRMED' && !future && <button type="button" disabled={busy} onClick={() => void run(() => apiFetch(`/sales/reservations/${id}/complete`, { method: 'POST', json: {} }))} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">Completar</button>}
              </div>
            )}

            {mode === 'reschedule' && <ActionForm title="Aplazar reserva" submitLabel="Guardar nueva fecha" busy={busy} onSubmit={submitReschedule} onCancel={() => setMode(null)}><label className="text-sm font-semibold text-slate-700">Nueva fecha<input required type="date" value={actionDate} onChange={event => setActionDate(event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label><label className="text-sm font-semibold text-slate-700">Nueva hora<input required type="time" value={actionTime} onChange={event => setActionTime(event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label><label className="sm:col-span-2 text-sm font-semibold text-slate-700">Motivo del aplazamiento (opcional)<textarea value={actionReason} onChange={event => setActionReason(event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label></ActionForm>}
            {mode === 'cancel' && <ActionForm title="Cancelar reserva" submitLabel="Confirmar cancelación" busy={busy} onSubmit={submitCancel} onCancel={() => setMode(null)}><label className="sm:col-span-2 text-sm font-semibold text-slate-700">Motivo de cancelación<textarea required value={actionReason} onChange={event => setActionReason(event.target.value)} className="mt-1 w-full rounded-lg border p-2" /></label></ActionForm>}
          </>
        )}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-[#001F3F]">Trazabilidad</h2>
          {!reservation.history?.length ? <p className="mt-3 text-slate-600">No hay eventos registrados.</p> : <ol className="mt-4 space-y-3">{reservation.history.map(entry => <li key={entry.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{reservationHistoryLabels[entry.action]}</strong><time className="text-sm text-slate-500">{formatReservationDateTime(entry.occurredAt)}</time></div><p className="mt-1 text-sm text-slate-600">{actorName(entry.actor)}</p>{entry.previousScheduledAt && entry.newScheduledAt && <p className="mt-2 text-sm">De {formatReservationDateTime(entry.previousScheduledAt)} a {formatReservationDateTime(entry.newScheduledAt)}</p>}{entry.note && <p className="mt-2 text-sm text-slate-700">{entry.note}</p>}</li>)}</ol>}
        </section>
      </div>
    </DashboardLayout>
  );
}

function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? 'sm:col-span-2 lg:col-span-3' : ''}><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap font-medium text-slate-900">{value}</dd></div>;
}

function ActionForm({ title, submitLabel, busy, onSubmit, onCancel, children }: { title: string; submitLabel: string; busy: boolean; onSubmit: (event: FormEvent) => void; onCancel: () => void; children: React.ReactNode }) {
  return <form className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={onSubmit}><h2 className="text-xl font-bold text-[#001F3F]">{title}</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div><div className="mt-5 flex justify-end gap-3"><button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2">Volver</button><button type="submit" disabled={busy} className="rounded-lg bg-[#001F3F] px-4 py-2 font-semibold text-white disabled:opacity-50">{submitLabel}</button></div></form>;
}
