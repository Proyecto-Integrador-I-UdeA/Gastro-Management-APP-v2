import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { getUsers, updateUser, deleteUser } from '../../controllers/user/userController';
import prisma from '../../lib/prisma';  // ← IMPORTAMOS PRISMA AQUÍ (para la ruta PATCH)

const router = Router();

// GET /users - Lista todos los usuarios
router.get('/', authenticate, authorize(['users.read']), getUsers);

// GET /users/:id - Obtiene un usuario por ID
router.get('/:id', authenticate, authorize(['users.read']), async (req, res) => {
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
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ error: 'Error interno al obtener el usuario' });
  }
});

// PATCH /users/:id - Actualiza usuario (usando prisma directamente)
router.patch('/:id', authenticate, authorize(['users.update']), async (req, res) => {
  const { id } = req.params;
  const { active, fullName, email } = req.body;
  try {
    const updatedUser = await prisma.user.update({
      where: { id: Number(id) },
      data: {
        active: active === undefined ? undefined : active,
        fullName: fullName || undefined,
        email: email || undefined,
      },
    });
    res.json(updatedUser);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// PUT /users/:id - Actualiza usuario (versión con Zod)
router.put('/:id', authenticate, authorize(['users.update']), updateUser);

// DELETE /users/:id - Inactiva usuario (soft delete)
router.delete('/:id', authenticate, authorize(['users.delete']), deleteUser);

export default router;