import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { updateUser, deleteUser } from '../../controllers/user/userController';
import prisma from '../../lib/prisma';  // ruta típica si tienes un client exportado

const router = Router();

router.get('/', authenticate, authorize(['users:read']), async (req, res) => {
  const users = await prisma.user.findMany({
    include: { role: { select: { name: true } } },
  });
  res.json(users);
});
//PATCH /users/:id - actualizar usuario (agrega esto si no existe)
router.patch('/:id', authenticate, authorize(['users:update']), async (req, res) => {
  const { id } = req.params;
  const { active, fullName, email, password } = req.body;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: Number(id) },
      data: {
        active: active === undefined ? undefined : active,
        fullName: fullName || undefined,
        email: email || undefined,
        // password: password ? await hashPassword(password) : undefined, // si cambias contraseña
      },
    });
    res.json(updatedUser);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// Editar usuario (solo para roles con permiso 'users:update')
router.put('/:id', authenticate, authorize(['users:update']), updateUser);

// Inactivar usuario (soft delete, solo para roles con permiso 'users:delete')
router.delete('/:id', authenticate, authorize(['users:delete']), deleteUser);

export default router;