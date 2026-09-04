import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma, PrismaClient } from '@prisma/client';
import { createUserSchema, updateUserSchema } from '../../schemas/userSchema';

const prisma = new PrismaClient();

// POST /users - Crea un colaborador dentro del flujo autenticado
export const createUser = async (req: Request, res: Response) => {
  const validation = createUserSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: validation.error.flatten(),
    });
  }

  const { email, password, fullName, roleId } = validation.data;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true },
    });
    if (!role) {
      return res.status(400).json({ error: 'El rol seleccionado no existe' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        roleId: role.id,
        active: true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        active: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json({
      message: 'Usuario creado correctamente',
      user,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }

    console.error('Error al crear usuario:', error);
    return res.status(500).json({ error: 'Error interno al crear el usuario' });
  }
};

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
