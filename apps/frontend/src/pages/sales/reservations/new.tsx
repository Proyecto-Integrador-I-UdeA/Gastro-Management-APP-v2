"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import ReservationForm, { ReservationFormPayload } from '@/components/reservations/ReservationForm';
import type { Reservation, ReservationTable } from '@/types/reservations';
import { apiFetch } from '@/utils/apiFetch';
import { getUserPermissions } from '@/utils/permissions';

export default function NewReservationPage() {
  const router = useRouter();
  const [permissionReady, setPermissionReady] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [tables, setTables] = useState<ReservationTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const allowed = getUserPermissions().includes('reservations.manage');
    setCanManage(allowed);
    setPermissionReady(true);
    if (!allowed) {
      setLoading(false);
      return;
    }
    apiFetch<{ tables: ReservationTable[] }>('/sales/reservations/references')
      .then(result => setTables(result.tables))
      .catch(reason => setError(reason instanceof Error ? reason.message : 'No fue posible cargar las mesas.'))
      .finally(() => setLoading(false));
  }, []);

  async function create(payload: ReservationFormPayload) {
    setBusy(true);
    setError('');
    try {
      const reservation = await apiFetch<Reservation>('/sales/reservations', { method: 'POST', json: payload });
      await router.push(`/sales/reservations/${reservation.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No fue posible crear la reserva.');
    } finally {
      setBusy(false);
    }
  }

  if (!permissionReady || loading) return <DashboardLayout><div className="p-8 text-slate-600">Cargando formulario...</div></DashboardLayout>;
  if (!canManage) return <DashboardLayout><div className="m-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">No tienes permiso para crear reservas.</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <div className="mb-6">
          <p className="text-sm font-medium text-slate-500">Reservas y eventos</p>
          <h1 className="mt-1 text-3xl font-bold text-[#001F3F]">Crear reserva</h1>
          <p className="mt-2 text-slate-600">Registra la información operativa de la reserva o evento.</p>
        </div>
        {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
        <ReservationForm creating tables={tables} busy={busy} onSubmit={create} onCancel={() => void router.push('/sales/reservations')} />
      </div>
    </DashboardLayout>
  );
}
