import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import {
  create,
  detail,
  list,
  references,
} from '../../controllers/finance/transferController';

const router = Router();

// ⚠️ Orden importa: rutas estáticas antes que paramétricas (/:id)
router.get('/references', authenticate, references);
router.get('/', authenticate, list);
router.post('/', authenticate, create);
router.get('/:id', authenticate, detail);

export default router;