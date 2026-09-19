import { FormEvent, useMemo, useState } from 'react';
import { bogotaInputParts, bogotaLocalToIso } from '@/lib/reservations';
import type { Reservation, ReservationStatus, ReservationTable, ReservationType } from '@/types/reservations';
import { reservationTypeLabels } from '@/types/reservations';

export type ReservationFormPayload = {
  customerName: string;
  phone: string;
  email: string | null;
  reservationType: ReservationType;
  scheduledAt: string;
  guestCount: number;
  preferredArea: string | null;
  diningTableId: number | null;
  reason: string;
  notes: string | null;
  isVip: boolean;
  status?: Extract<ReservationStatus, 'PENDING' | 'CONFIRMED'>;
};

function todayBogota() {
  return bogotaInputParts(new Date().toISOString()).date;
}

export default function ReservationForm({
  initial,
  tables,
  creating = false,
  busy = false,
  onSubmit,
  onCancel,
}: {
  initial?: Reservation;
  tables: ReservationTable[];
  creating?: boolean;
  busy?: boolean;
  onSubmit: (payload: ReservationFormPayload) => Promise<void> | void;
  onCancel: () => void;
}) {
  const initialDateTime = initial ? bogotaInputParts(initial.scheduledAt) : { date: '', time: '' };
  const [customerName, setCustomerName] = useState(initial?.customerName ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [reservationType, setReservationType] = useState<ReservationType>(initial?.reservationType ?? 'TABLE_RESERVATION');
  const [date, setDate] = useState(initialDateTime.date);
  const [time, setTime] = useState(initialDateTime.time);
  const [guestCount, setGuestCount] = useState(initial ? String(initial.guestCount) : '');
  const [preferredArea, setPreferredArea] = useState(initial?.preferredArea ?? '');
  const [diningTableId, setDiningTableId] = useState(initial?.diningTableId ? String(initial.diningTableId) : '');
  const [reason, setReason] = useState(initial?.reason ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [status, setStatus] = useState<Extract<ReservationStatus, 'PENDING' | 'CONFIRMED'>>(
    initial?.status === 'CONFIRMED' ? 'CONFIRMED' : 'PENDING',
  );
  const [isVip, setIsVip] = useState(initial?.isVip ?? false);
  const [validationError, setValidationError] = useState('');

  const areas = useMemo(() => Array.from(new Set(tables.map(table => table.area).filter(Boolean) as string[])).sort(), [tables]);
  const assignableTables = tables.filter(table => table.active || table.id === initial?.diningTableId);

  function submit(event: FormEvent) {
    event.preventDefault();
    const scheduledAt = bogotaLocalToIso(date, time);
    const guests = Number(guestCount);
    if (!customerName.trim() || !phone.trim() || !reason.trim()) {
      setValidationError('Completa cliente, teléfono y motivo.');
      return;
    }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setValidationError('Ingresa un correo electrónico válido.');
      return;
    }
    if (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now()) {
      setValidationError('Selecciona una fecha y hora futura válidas.');
      return;
    }
    if (!Number.isInteger(guests) || guests <= 0) {
      setValidationError('El número de personas debe ser un entero mayor que 0.');
      return;
    }
    setValidationError('');
    void onSubmit({
      customerName: customerName.trim(),
      phone: phone.trim(),
      email: email.trim() || null,
      reservationType,
      scheduledAt,
      guestCount: guests,
      preferredArea: preferredArea.trim() || null,
      diningTableId: diningTableId ? Number(diningTableId) : null,
      reason: reason.trim(),
      notes: notes.trim() || null,
      isVip,
      ...(creating ? { status } : {}),
    });
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2';
  return (
    <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" onSubmit={submit}>
      {validationError && <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">{validationError}</p>}
      <div className="grid gap-5 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">Cliente / responsable
          <input required maxLength={200} value={customerName} onChange={event => setCustomerName(event.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-semibold text-slate-700">Teléfono
          <input required type="tel" maxLength={50} value={phone} onChange={event => setPhone(event.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-semibold text-slate-700">Correo electrónico
          <input type="email" maxLength={320} value={email} onChange={event => setEmail(event.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-semibold text-slate-700">Tipo de reserva
          <select value={reservationType} onChange={event => setReservationType(event.target.value as ReservationType)} className={inputClass}>
            {(Object.keys(reservationTypeLabels) as ReservationType[]).map(type => <option key={type} value={type}>{reservationTypeLabels[type]}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">Fecha
          <input required type="date" min={todayBogota()} value={date} onChange={event => setDate(event.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-semibold text-slate-700">Hora
          <input required type="time" value={time} onChange={event => setTime(event.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-semibold text-slate-700">Número de personas
          <input required type="number" min="1" step="1" value={guestCount} onChange={event => setGuestCount(event.target.value)} className={inputClass} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">Zona preferida
            <input list="reservation-areas" value={preferredArea} onChange={event => setPreferredArea(event.target.value)} className={inputClass} placeholder="Opcional" />
            <datalist id="reservation-areas">{areas.map(area => <option key={area} value={area} />)}</datalist>
          </label>
          <label className="text-sm font-semibold text-slate-700">Mesa preferida
            <select value={diningTableId} onChange={event => setDiningTableId(event.target.value)} className={inputClass}>
              <option value="">Sin mesa asignada</option>
              {assignableTables.map(table => <option key={table.id} value={table.id}>Mesa {table.code}{table.area ? ` · ${table.area}` : ''}</option>)}
            </select>
          </label>
        </div>
        <label className="text-sm font-semibold text-slate-700">Motivo
          <input required maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className={inputClass} />
        </label>
        {creating ? (
          <label className="text-sm font-semibold text-slate-700">Estado
            <select value={status} onChange={event => setStatus(event.target.value as typeof status)} className={inputClass}>
              <option value="PENDING">Pendiente</option>
              <option value="CONFIRMED">Confirmada</option>
            </select>
          </label>
        ) : <div />}
        <label className="md:col-span-2 text-sm font-semibold text-slate-700">Observaciones
          <textarea rows={4} maxLength={4000} value={notes} onChange={event => setNotes(event.target.value)} className={inputClass} />
        </label>
        <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 font-semibold text-amber-900">
          <input type="checkbox" checked={isVip} onChange={event => setIsVip(event.target.checked)} />
          Clasificación VIP
        </label>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-5 py-2 font-semibold text-slate-700">Cancelar</button>
        <button type="submit" disabled={busy} className="rounded-lg bg-[#001F3F] px-5 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Guardando...' : creating ? 'Guardar reserva' : 'Guardar cambios'}</button>
      </div>
    </form>
  );
}
