import { Router } from 'express';
import { register, login, changePassword } from '../../controllers/auth/authController';
import { authenticate } from '../../middlewares/auth'; // importamos authenticate (el middleware que verifica el token)

const router = Router();

// Registro de nuevo usuario (sin autenticación)
router.post('/register', register);

// Login (sin autenticación)
router.post('/login', login);

// Cambiar contraseña (solo usuarios autenticados)
router.post('/change-password', authenticate, changePassword);

export default router;