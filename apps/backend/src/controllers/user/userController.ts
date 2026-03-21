import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { updateUserSchema } from '../../schemas/userSchema';

const prisma = new PrismaClient();

// GET /users - Lista todos los usuarios (protegida)
export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: { select: { name: true } },
        active: true,
        createdAt: true,
      },
    });
    res.json(users);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error interno al obtener la lista de usuarios' });
  }
};

// GET /users/:id - Obtiene un usuario por ID
export const getUserById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      include: { role: { select: { name: true } } },
    });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error al obtener usuario por ID:', error);
    res.status(500).json({ error: 'Error interno al obtener el usuario' });
  }
};

// PUT /users/:id - Actualiza un usuario
export const updateUser = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validación con Zod
  const validation = updateUserSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: validation.error.flatten().fieldErrors,
    });
  }

  const { email, fullName, roleId, active } = validation.data;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { id: Number(id) },
    });
    if (!existingUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: Number(id) },
      data: {
        ...(email !== undefined && { email }),
        ...(fullName !== undefined && { fullName }),
        ...(roleId !== undefined && { roleId }),
        ...(active !== undefined && { active }),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: { select: { name: true } },
        active: true,
      },
    });

    res.json({
      message: 'Usuario actualizado correctamente',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error interno al actualizar el usuario' });
  }
};

// DELETE /users/:id - Inactiva usuario (soft delete)
export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
    });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (!user.active) {
      return res.status(400).json({ error: 'El usuario ya está inactivo' });
    }
    await prisma.user.update({
      where: { id: Number(id) },
      data: { active: false },
    });
    res.json({ message: 'Usuario inactivado correctamente (soft delete)' });
  } catch (error) {
    console.error('Error al inactivar usuario:', error);
    res.status(500).json({ error: 'Error interno al inactivar el usuario' });
  }
};