import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { getUsers, updateUser, deleteUser } from '../../controllers/user/userController';

const router = Router();

// Lista de usuarios (solo para roles con permiso 'users:read')
router.get('/', authenticate, authorize(['users:read']), getUsers);

// Editar usuario (solo para roles con permiso 'users:update')
router.put('/:id', authenticate, authorize(['users:update']), updateUser);

// Inactivar usuario (soft delete, solo para roles con permiso 'users:delete')
router.delete('/:id', authenticate, authorize(['users:delete']), deleteUser);

export default router;