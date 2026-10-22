import { apiFetch } from '@/utils/apiFetch';
import type {
  CreateTransferInput,
  ListTransfersQuery,
  Transfer,
  TransferReferences,
} from '@/types/finance/transfer';

// ⚠️ Content-Type explícito para que express.json() parsee el body.
const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

export async function fetchTransfers(
  query: ListTransfersQuery,
): Promise<{ transfers: Transfer[] }> {
  const params = new URLSearchParams();
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.sourceMethodId) params.set('sourceMethodId', String(query.sourceMethodId));
  if (query.targetMethodId) params.set('targetMethodId', String(query.targetMethodId));
  if (query.search) params.set('search', query.search);
  return apiFetch<{ transfers: Transfer[] }>(`/finance/transfers?${params.toString()}`);
}

export async function fetchTransferReferences(): Promise<TransferReferences> {
  return apiFetch<TransferReferences>('/finance/transfers/references');
}

export async function createTransfer(input: CreateTransferInput): Promise<Transfer> {
  const body = JSON.stringify(input);
  console.log('[transferApi] POST body:', body);
  return apiFetch<Transfer>('/finance/transfers', {
    method: 'POST',
    headers: JSON_HEADERS,
    body,
  });
}