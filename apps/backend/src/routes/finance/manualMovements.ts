import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import {
  cancel,
  confirm,
  create,
  detail,
  list,
  references,
  summary,
  update,
} from '../../controllers/finance/manualMovementController';

const router = Router();


router.get('/summary', authenticate, summary);
router.get('/references', authenticate, references);

router.get('/', authenticate, list);
router.post('/', authenticate, create);
router.get('/:id', authenticate, detail);
router.put('/:id', authenticate, update);
router.post('/:id/confirm', authenticate, confirm);
router.post('/:id/cancel', authenticate, cancel);

export default router;