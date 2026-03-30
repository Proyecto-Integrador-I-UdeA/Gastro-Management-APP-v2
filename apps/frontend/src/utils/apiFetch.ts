/**
 * Browser fetch helper for App Router client code.
 * Avoids bundling axios on the Next server (fixes missing vendor-chunks/axios.js).
 * Pages under `src/pages/` can keep using `utils/api.ts` (axios) until migrated.
 */
import { API_BASE_URL } from '@/config/apiBase';

type ApiFetchOptions = RequestInit & {
  /** When set, body is JSON.stringify(json) and Content-Type is set */
  json?: unknown;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { json, headers: initHeaders, body: initBody, ...rest } = options;
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(initHeaders);
  if (globalThis.window !== undefined) {
    const token = localStorage.getItem('token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  let body: BodyInit | null | undefined = initBody;
  if (json !== undefined) {
    body = JSON.stringify(json);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  const res = await fetch(url, { ...rest, headers, body });
  const text = await res.text();
  let data: unknown;
  if (!text) {
    data = undefined;
  } else {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg =
      data && typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: string }).error)
        : res.statusText || `HTTP ${res.status}`;
    const err = new Error(msg) as Error & { status: number; body: unknown };
    err.status = res.status;
    err.body = data;
    throw err;
  }

  return data as T;
}
