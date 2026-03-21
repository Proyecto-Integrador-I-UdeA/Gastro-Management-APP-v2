import type { Supplier } from '@/types/supplier';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

/** Ignores nested `products` from GET /suppliers/:id */
export function normalizeSupplierFromApi(raw: unknown): Supplier | undefined {
  const s = asRecord(raw);
  if (!s || s.id === undefined || s.id === null) return undefined;
  return {
    id: Number(s.id),
    internalCode: String(s.internalCode ?? ''),
    name: String(s.name ?? ''),
    taxId: String(s.taxId ?? ''),
    phone: String(s.phone ?? ''),
    address: String(s.address ?? ''),
    contactPerson: String(s.contactPerson ?? ''),
  };
}
