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

// Editar usuario (solo para roles con permiso 'users:update')
router.put('/:id', authenticate, authorize(['users:update']), updateUser);

// Inactivar usuario (soft delete, solo para roles con permiso 'users:delete')
router.delete('/:id', authenticate, authorize(['users:delete']), deleteUser);

export default router;