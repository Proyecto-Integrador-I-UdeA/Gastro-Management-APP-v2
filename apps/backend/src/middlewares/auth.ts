import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'tu-secreto-super-seguro';

interface AuthenticatedRequest extends Request {
  user?: { id: number; email: string; role: string };
}

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string; role: string };
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const authorize = (requiredPermissions: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
      // Obtener todos los permisos del rol del usuario
      const role = await prisma.role.findUnique({
        where: { name: req.user.role },
        include: { permissions: { include: { permission: true } } },
      });

      if (!role) {
        return res.status(403).json({ error: 'Role not found' });
      }

      const userPermissions = role.permissions.map(rp => rp.permission.name);

      const hasAllPermissions = requiredPermissions.every(perm => userPermissions.includes(perm));

      if (!hasAllPermissions) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error checking permissions' });
    }
  };
};









