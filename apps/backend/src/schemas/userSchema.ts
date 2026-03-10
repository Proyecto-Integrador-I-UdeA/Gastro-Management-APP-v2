import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email({ message: 'Email inválido' }),
  password: z.string().min(8, { message: 'La contraseña debe tener al menos 8 caracteres' }),
  fullName: z.string().min(2, { message: 'Nombre completo requerido' }).optional(),
  roleId: z.number().int().positive().optional(), // opcional por ahora
});

export const loginSchema = z.object({
  email: z.string().email({ message: 'Email inválido' }),
  password: z.string().min(1, { message: 'Contraseña requerida' }),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(2).optional(),
  roleId: z.number().int().positive().optional(),
  active: z.boolean().optional(),
});