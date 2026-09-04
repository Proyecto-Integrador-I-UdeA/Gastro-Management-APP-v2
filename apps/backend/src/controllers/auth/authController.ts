import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma, PrismaClient } from '@prisma/client';
import { registerSchema } from '../../schemas/userSchema';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'tu-secreto-super-seguro';

class InitialRegistrationUnavailableError extends Error {}
class AdminRoleNotConfiguredError extends Error {}

export const register = async (req: Request, res: Response) => {
  const validation = registerSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos inválidos para el registro inicial',
      details: validation.error.flatten(),
    });
  }

  const { email, password, fullName } = validation.data;

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const userCount = await tx.user.count();
      if (userCount > 0) {
        throw new InitialRegistrationUnavailableError();
      }

      const adminRole = await tx.role.findUnique({
        where: { name: 'admin' },
        select: { id: true },
      });
      if (!adminRole) {
        throw new AdminRoleNotConfiguredError();
      }

      return tx.user.create({
        data: {
          email,
          passwordHash,
          fullName,
          roleId: adminRole.id,
          active: true,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          active: true,
          role: { select: { name: true } },
        },
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    return res.status(201).json({
      message: 'Registro inicial completado exitosamente',
      user,
    });
  } catch (error) {
    if (
      error instanceof InitialRegistrationUnavailableError ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034'))
    ) {
      return res.status(409).json({ error: 'El registro inicial ya fue completado' });
    }

    if (error instanceof AdminRoleNotConfiguredError) {
      return res.status(503).json({
        error: 'El rol admin no está configurado; no se puede completar el registro inicial',
      });
    }

    console.error(error);
    return res.status(500).json({ error: 'Error al registrar usuario' });
  }
};

export const getRegistrationStatus = async (_req: Request, res: Response) => {
  try {
    const userCount = await prisma.user.count();
    return res.json({ registrationAvailable: userCount === 0 });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al consultar el estado del registro' });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  try {
    console.log('LOGIN CON PERMISSIONS EJECUTANDOSE');

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // 🔥 EXTRAER PERMISOS DEL ROL
    const permissions =
      user.role?.permissions.map(rp => rp.permission.name) || [];

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role?.name ?? 'sin_rol',
        permissions, // 👈 CLAVE
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role?.name ?? 'sin_rol',
        permissions, // 👈 útil para frontend
      },
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user;

    if (!authUser || !authUser.id) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const userId = authUser.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'La nueva contraseña debe tener al menos 8 caracteres'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
      },
    });

    return res.json({
      message: 'Contraseña actualizada con éxito'
    });

  } catch (error) {
    console.error('Error al cambiar contraseña:', error);

    return res.status(500).json({
      error: 'Error interno al cambiar la contraseña'
    });
  }
};
