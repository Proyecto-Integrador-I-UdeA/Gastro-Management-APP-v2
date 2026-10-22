import { useCallback, useEffect, useState } from 'react';
import {
  cancelManualMovement,
  confirmManualMovement,
  createManualMovement,
  fetchManualMovements,
  fetchManualMovementReferences,
  fetchManualMovementSummary,
  fetchPosSalesOfDay,
} from '@/lib/finance/manualMovementApi';
import type {
  CreateManualMovementInput,
  ListManualMovementsQuery,
  ManualMovement,
  ManualMovementReferences,
  ManualMovementSummary,
  PosSalesOfDay,
} from '@/types/finance/manualMovement';

export function useManualMovementsList(query: ListManualMovementsQuery) {
  const [data, setData] = useState<ManualMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  const { from, to, kind, status, paymentMethodId, search } = query;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchManualMovements({ from, to, kind, status, paymentMethodId, search })
      .then(res => { if (!cancelled) setData(res.movements); })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Error cargando movimientos');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, kind, status, paymentMethodId, search, refreshTick]);

  const refresh = useCallback(() => setRefreshTick(t => t + 1), []);
  return { data, loading, error, refresh };
}

export function useManualMovementSummary(date: string) {
  const [data, setData] = useState<ManualMovementSummary | null>(null);
  const [posSales, setPosSales] = useState<PosSalesOfDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([
      fetchManualMovementSummary(date),
      fetchPosSalesOfDay(date).catch(() => ({
        cashSalesAmount: '0.00',
        totalCollected: '0.00',
        orderCount: 0,
      })),
    ])
      .then(([summary, pos]) => {
        if (cancelled) return;
        setData(summary);
        setPosSales(pos);
      })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Error cargando resumen');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date, refreshTick]);

  const refresh = useCallback(() => setRefreshTick(t => t + 1), []);
  return { data, posSales, loading, error, refresh };
}

export function useManualMovementReferences() {
  const [data, setData] = useState<ManualMovementReferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchManualMovementReferences()
      .then(res => { if (!cancelled) setData(res); })
      .catch(cause => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Error cargando catálogos');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshTick]);

  const refresh = useCallback(() => setRefreshTick(t => t + 1), []);
  return { data, loading, error, refresh };
}

function buildErrorMessage(cause: unknown, fallback: string): string {
  if (!(cause instanceof Error)) return fallback;
  type BodyShape = { details?: Array<{ path?: Array<string | number>; message?: string }> };
  const err = cause as Error & { body?: BodyShape };
  const details = err.body?.details;
  if (!details || details.length === 0) return err.message || fallback;
  const detailStr = details
    .map(d => `${(d.path ?? []).join('.') || '(root)'}: ${d.message ?? 'inválido'}`)
    .join(' | ');
  return `${err.message} — ${detailStr}`;
}

export function useManualMovementActions() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const create = useCallback(async (input: CreateManualMovementInput) => {
    setSubmitting(true);
    setError('');
    try {
      return await createManualMovement(input);
    } catch (cause) {
      const message = buildErrorMessage(cause, 'Error creando movimiento');
      setError(message);
      throw cause;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const cancel = useCallback(async (id: number, reason: string) => {
    setSubmitting(true);
    setError('');
    try {
      return await cancelManualMovement(id, reason);
    } catch (cause) {
      const message = buildErrorMessage(cause, 'Error cancelando movimiento');
      setError(message);
      throw cause;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const confirm = useCallback(async (id: number) => {
    setSubmitting(true);
    setError('');
    try {
      return await confirmManualMovement(id);
    } catch (cause) {
      const message = buildErrorMessage(cause, 'Error confirmando movimiento');
      setError(message);
      throw cause;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { create, cancel, confirm, submitting, error };
}