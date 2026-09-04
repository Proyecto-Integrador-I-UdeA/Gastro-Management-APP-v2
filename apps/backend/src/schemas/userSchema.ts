import { z } from 'zod';

const userCreationBaseSchema = z.object({
  email: z.string().trim().email({ message: 'Email inválido' }),
  password: z.string().min(8, { message: 'La contraseña debe tener al menos 8 caracteres' }),
  fullName: z.string().trim().min(2, { message: 'Nombre completo requerido' }),
});

export const registerSchema = userCreationBaseSchema.strict();

export const createUserSchema = userCreationBaseSchema.extend({
  roleId: z.number().int().positive({ message: 'Rol requerido' }),
}).strict();

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
