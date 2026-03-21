/**
 * Works for axios errors (pages/) and fetch errors from apiFetch (app/).
 * Intentionally does not import axios so App Router bundles stay free of axios on the server.
 */
export function getApiErrorMessage(err: unknown, fallback = 'Error inesperado'): string {
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;

    const body = e.body;
    if (body && typeof body === 'object' && body !== null && 'error' in body) {
      return String((body as { error: string }).error);
    }

    const response = e.response as { data?: { error?: string; message?: string } } | undefined;
    if (response?.data?.error) return String(response.data.error);
    if (response?.data?.message) return String(response.data.message);

    if (typeof e.message === 'string' && e.message.length > 0) return e.message;
  }
  return fallback;
}

export function isUnauthorized(err: unknown): boolean {
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    if (e.status === 401) return true;
    const response = e.response as { status?: number } | undefined;
    if (response?.status === 401) return true;
  }
  return false;
}
