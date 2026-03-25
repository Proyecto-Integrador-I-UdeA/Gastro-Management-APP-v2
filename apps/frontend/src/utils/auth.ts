// src/utils/auth.ts
import * as jose from 'jose';

interface JwtPayload {
  id: number;
  email: string;
  role: string | number;
  iat?: number;
  exp?: number;
}

export function getUserRole(): string | number | null {
  if (typeof window === 'undefined') return null;

  const token = localStorage.getItem('token');
  if (!token) return null;

  try {
    const payload = jose.decodeJwt<JwtPayload>(token);
    return payload.role ?? null;
  } catch {
    return null;
  }
}

// 🔥 normalizamos el rol
function normalizeRole(role: any): string {
  if (!role) return '';

  if (typeof role === 'number') {
    const map: Record<number, string> = {
      1: 'super',
      2: 'admin',
      3: 'chef',
      4: 'compras',
      5: 'contabilidad',
    };
    return map[role] || '';
  }

  return String(role).toLowerCase();
}

// 🔥 helpers

export function isSuperUser(): boolean {
  const role = normalizeRole(getUserRole());
  return role === 'super' || role === 'superusuario';
}

export function isAdmin(): boolean {
  const role = normalizeRole(getUserRole());
  return role === 'admin' || role === 'administrador';
}