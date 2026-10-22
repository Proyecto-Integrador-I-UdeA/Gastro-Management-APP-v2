import { useEffect, useState } from 'react';
import type {
  CreateTransferInput,
  PaymentMethodRef,
} from '@/types/finance/transfer';

type Props = {
  open: boolean;
  paymentMethods: PaymentMethodRef[];
  submitting: boolean;
  serverError: string;
  onClose: () => void;
  onSubmit: (input: CreateTransferInput) => Promise<void>;
};

function todayInBogota() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function money(value: string | number, currency = 'COP') {
  const safe = /^[A-Z]{3}$/.test(currency) ? currency : 'COP';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: safe,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

export default function TransferForm({
  open,
  paymentMethods,
  submitting,
  serverError,
  onClose,
  onSubmit,
}: Props) {
  const [occurredAt, setOccurredAt] = useState(todayInBogota());
  const [sourceMethodId, setSourceMethodId] = useState('');
  const [targetMethodId, setTargetMethodId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [clientError, setClientError] = useState('');

  useEffect(() => {
    if (!open) return;
    setOccurredAt(todayInBogota());
    setSourceMethodId('');
    setTargetMethodId('');
    setAmount('');
    setDescription('');
    setDocumentNumber('');
    setClientError('');
  }, [open]);

  if (!open) return null;

  const source = paymentMethods.find(m => String(m.id) === sourceMethodId);
  const target = paymentMethods.find(m => String(m.id) === targetMethodId);
  const sameCurrency = source && target ? source.currency === target.currency : true;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setClientError('');

    if (!sourceMethodId) {
      setClientError('Seleccioná el medio de origen');
      return;
    }
    if (!targetMethodId) {
      setClientError('Seleccioná el medio de destino');
      return;
    }
    if (sourceMethodId === targetMethodId) {
      setClientError('Origen y destino deben ser distintos');
      return;
    }
    if (source && target && source.currency !== target.currency) {
      setClientError('Origen y destino deben tener la misma moneda');
      return;
    }
    if (!description.trim()) {
      setClientError('La descripción es obligatoria');
      return;
    }

    const normalizedAmount = amount.replace(',', '.').trim();
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(normalizedAmount)) {
      setClientError('El monto debe ser un número positivo (ej. 1500.00)');
      return;
    }
    if (Number(normalizedAmount) <= 0) {
      setClientError('El monto debe ser mayor a 0');
      return;
    }
    if (source && Number(normalizedAmount) > Number(source.currentBalance)) {
      setClientError(
        `Saldo insuficiente en ${source.name}. Disponible: ${money(source.currentBalance, source.currency)}`,
      );
      return;
    }

    const payload: Record<string, unknown> = {
      occurredAt,
      sourceMethodId: Number(sourceMethodId),
      targetMethodId: Number(targetMethodId),
      amount: normalizedAmount,
      description: description.trim(),
    };
    if (documentNumber.trim()) payload.documentNumber = documentNumber.trim();

    console.log('[TransferForm] payload a enviar:', JSON.stringify(payload));

    await onSubmit(payload as CreateTransferInput);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-[#001F3F]">Nueva transferencia</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            disabled={submitting}
          >
            Cerrar
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Fecha *
              <input
                type="date"
                required
                value={occurredAt}
                onChange={e => setOccurredAt(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Monto *
              <input
                type="text"
                required
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Medio de origen *
              <select
                required
                value={sourceMethodId}
                onChange={e => setSourceMethodId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2"
              >
                <option value="">— Seleccioná —</option>
                {paymentMethods.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {money(m.currentBalance, m.currency)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Medio de destino *
              <select
                required
                value={targetMethodId}
                onChange={e => setTargetMethodId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2"
              >
                <option value="">— Seleccioná —</option>
                {paymentMethods
                  .filter(m => String(m.id) !== sourceMethodId)
                  .map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {money(m.currentBalance, m.currency)}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          {!sameCurrency && source && target && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Origen ({source.currency}) y destino ({target.currency}) tienen monedas distintas.
            </p>
          )}

          <label className="block text-sm font-semibold text-slate-700">
            Descripción *
            <input
              type="text"
              required
              maxLength={300}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ej: Traslado a banco, pago tarjeta corporativa"
              className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Documento <span className="text-xs font-normal text-slate-500">(opcional)</span>
            <input
              type="text"
              maxLength={120}
              value={documentNumber}
              onChange={e => setDocumentNumber(e.target.value)}
              placeholder="Ej: TRF-001"
              className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
            />
          </label>

          {(clientError || serverError) && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              {clientError || serverError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#001F3F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1b4770] disabled:opacity-50"
            >
              {submitting ? 'Guardando…' : 'Guardar transferencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}