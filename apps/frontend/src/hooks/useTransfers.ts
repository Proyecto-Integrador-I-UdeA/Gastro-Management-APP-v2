import { useCallback, useEffect, useState } from 'react';
import {
  createTransfer,
  fetchTransfers,
  fetchTransferReferences,
} from '@/lib/finance/transferApi';
import type {
  CreateTransferInput,
  ListTransfersQuery,
  Transfer,
  TransferReferences,
} from '@/types/finance/transfer';

function buildErrorMessage(cause: unknown, fallback: string): string {
  if (!(cause instanceof Error)) return fallback;
  type BodyShape = {
    details?: Array<{ path?: Array<string | number>; message?: string }>;
    available?: string;
    requested?: string;
    shortfall?: string;
  };
  const err = cause as Error & { body?: BodyShape };
  const body = err.body;
  if (!body) return err.message || fallback;
  if (body.available !== undefined && body.requested !== undefined) {
    const short = body.shortfall ?? '?';
    return `Saldo insuficiente. Disponible: ${body.available} · Solicitado: ${body.requested} · Faltante: ${short}`;
  }
  const details = body.details;
  if (!details || details.length === 0) return err.message || fallback;
  const detailStr = details
    .map(d => `${(d.path ?? []).join('.') || '(root)'}: ${d.message ?? 'inválido'}`)
    .join(' | ');
  return `${err.message} — ${detailStr}`;
}

export function useTransfersList(query: ListTransfersQuery) {
  const [data, setData] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  const { from, to, sourceMethodId, targetMethodId, search } = query;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchTransfers({ from, to, sourceMethodId, targetMethodId, search })
      .then(res => { if (!cancelled) setData(res.transfers); })
      .catch(cause => {
        if (!cancelled) setError(buildErrorMessage(cause, 'Error cargando transferencias'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, sourceMethodId, targetMethodId, search, refreshTick]);

  const refresh = useCallback(() => setRefreshTick(t => t + 1), []);
  return { data, loading, error, refresh };
}

export function useTransferReferences() {
  const [data, setData] = useState<TransferReferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchTransferReferences()
      .then(res => { if (!cancelled) setData(res); })
      .catch(cause => {
        if (!cancelled) setError(buildErrorMessage(cause, 'Error cargando medios'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshTick]);

  const refresh = useCallback(() => setRefreshTick(t => t + 1), []);
  return { data, loading, error, refresh };
}

export function useTransferActions() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const create = useCallback(async (input: CreateTransferInput) => {
    setSubmitting(true);
    setError('');
    try {
      return await createTransfer(input);
    } catch (cause) {
      setError(buildErrorMessage(cause, 'Error creando transferencia'));
      throw cause;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { create, submitting, error };
}