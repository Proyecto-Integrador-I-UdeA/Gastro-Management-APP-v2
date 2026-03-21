// src/utils/auth.ts
import * as jose from 'jose';

interface JwtPayload {
  id: number;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export function getUserRole(): string | null {
  if (globalThis.window === undefined) {
    console.log('Ejecutando en servidor → no hay localStorage');
    return null;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    console.log('No hay token en localStorage');
    return null;
  }

  try {
    const payload = jose.decodeJwt<JwtPayload>(token);
    const role = payload.role?.toLowerCase() || null;
    console.log('Token decodificado con jose. Rol detectado:', role);
    return role;
  } catch (error) {
    console.error('Error al decodificar token con jose:', error);
    return null;
  }
}

export function isSuperUser(): boolean {
  const role = getUserRole();
  const isSuper = role === 'super';
  console.log('¿Es superusuario?', isSuper, '(rol detectado:', role, ')');
  return isSuper;
}