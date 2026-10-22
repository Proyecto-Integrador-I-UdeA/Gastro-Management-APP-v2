import { useEffect, useState } from 'react';
import type {
  CounterpartyRef,
  CreateManualMovementInput,
  MovementKind,
  PaymentMethodRef,
} from '@/types/finance/manualMovement';

type Props = {
  open: boolean;
  counterparties: CounterpartyRef[];
  paymentMethods: PaymentMethodRef[];
  submitting: boolean;
  serverError: string;
  onClose: () => void;
  onSubmit: (input: CreateManualMovementInput) => Promise<void>;
};

function todayInBogota() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function MovementForm({
  open,
  counterparties,
  paymentMethods,
  submitting,
  serverError,
  onClose,
  onSubmit,
}: Props) {
  const [kind, setKind] = useState<MovementKind>('EXPENSE');
  const [occurredAt, setOccurredAt] = useState(todayInBogota());
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [counterpartyId, setCounterpartyId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState(
    paymentMethods[0] ? String(paymentMethods[0].id) : '',
  );
  const [clientError, setClientError] = useState('');

  // ⚠️ SOLO depende de `open` (no de paymentMethods).
  // Depender de paymentMethods (referencia de array) causaba resets
  // durante el tipeo cuando el padre re-renderizaba.
  useEffect(() => {
    if (!open) return;
    setKind('EXPENSE');
    setOccurredAt(todayInBogota());
    setConcept('');
    setAmount('');
    setDocumentNumber('');
    setCounterpartyId('');
    setPaymentMethodId(paymentMethods[0] ? String(paymentMethods[0].id) : '');
    setClientError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Efecto separado: si los paymentMethods cargan DESPUÉS de abrir el form,
  // seteamos el default sin resetear el resto de los campos.
  useEffect(() => {
    if (!open) return;
    if (paymentMethodId === '' && paymentMethods.length > 0) {
      setPaymentMethodId(String(paymentMethods[0].id));
    }
  }, [open, paymentMethods, paymentMethodId]);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setClientError('');

    // ⚠️ DEBUG: muestra el estado real al momento de submit
    console.log('[MovementForm] STATE at submit:', {
      kind, occurredAt, concept, amount, paymentMethodId, counterpartyId, documentNumber,
      typeofKind: typeof kind,
      typeofOccurredAt: typeof occurredAt,
      typeofConcept: typeof concept,
      typeofAmount: typeof amount,
      typeofPaymentMethodId: typeof paymentMethodId,
    });

    if (!concept.trim()) {
      setClientError('El concepto es obligatorio');
      return;
    }
    if (!occurredAt) {
      setClientError('La fecha es obligatoria');
      return;
    }
    if (!paymentMethodId) {
      setClientError('Seleccioná un medio de pago');
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

    const payload: Record<string, unknown> = {
      kind,
      occurredAt,
      concept: concept.trim(),
      amount: normalizedAmount,
      currency: 'COP',
      paymentMethodId: Number(paymentMethodId),
    };
    if (documentNumber.trim()) payload.documentNumber = documentNumber.trim();
    if (counterpartyId) payload.counterpartyId = Number(counterpartyId);

    console.log('[MovementForm] PAYLOAD to send:', JSON.stringify(payload));

    await onSubmit(payload as CreateManualMovementInput);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-[#001F3F]">Nuevo movimiento</h2>
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setKind('INCOME')}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                kind === 'INCOME'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Ingreso
            </button>
            <button
              type="button"
              onClick={() => setKind('EXPENSE')}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                kind === 'EXPENSE'
                  ? 'border-red-600 bg-red-50 text-red-800'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Egreso
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Fecha *
              <input
                name="occurredAt"
                type="date"
                required
                value={occurredAt}
                onChange={e => setOccurredAt(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Medio de pago *
              <select
                name="paymentMethodId"
                required
                value={paymentMethodId}
                onChange={e => setPaymentMethodId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2"
              >
                <option value="">— Seleccioná —</option>
                {paymentMethods.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} (saldo: {m.currentBalance})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm font-semibold text-slate-700">
            Concepto *
            <input
              name="concept"
              type="text"
              required
              maxLength={300}
              value={concept}
              onChange={e => setConcept(e.target.value)}
              placeholder="Ej: Pago de arriendo marzo, Venta de catering"
              className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Tercero <span className="text-xs font-normal text-slate-500">(opcional)</span>
              <select
                name="counterpartyId"
                value={counterpartyId}
                onChange={e => setCounterpartyId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2"
              >
                <option value="">— Sin tercero —</option>
                {counterparties.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.kind})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Documento <span className="text-xs font-normal text-slate-500">(opcional)</span>
              <input
                name="documentNumber"
                type="text"
                maxLength={120}
                value={documentNumber}
                onChange={e => setDocumentNumber(e.target.value)}
                placeholder="Ej: FAC-001"
                className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
              />
            </label>
          </div>

          <label className="block text-sm font-semibold text-slate-700">
            Monto *
            <input
              name="amount"
              type="text"
              required
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
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
              {submitting ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}