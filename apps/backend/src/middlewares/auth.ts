import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'tu-secreto-super-seguro';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    permissions?: string[];
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      email: string;
      role: string;
      permissions?: string[];
    };

    req.user = decoded;

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

function normalizePermission(p: string): string {
  return p.trim().toLowerCase();
}

function normalizedUserPermissions(userPermissions: string[] | undefined): string[] {
  return (userPermissions || []).map(normalizePermission);
}

export const authorize = (requiredPermissions: string[]) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userSet = new Set(normalizedUserPermissions(req.user.permissions));
    const required = requiredPermissions.map(normalizePermission);
    const hasAllPermissions = required.every((perm) => userSet.has(perm));

    if (!hasAllPermissions) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

/** Al menos uno de los permisos listados (útil para flujos de traslados + bodegas). */
export const authorizeAny = (anyOfPermissions: string[]) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userSet = new Set(normalizedUserPermissions(req.user.permissions));
    const candidates = anyOfPermissions.map(normalizePermission);
    const allowed = candidates.some((perm) => userSet.has(perm));

    if (!allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};



