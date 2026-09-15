import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import * as controller from '../../controllers/inventory/inventoryPhysicalCountController';

const router = Router();
router.use(authenticate);
router.get('/references', authorize(['inventory.read']), controller.references);
router.get('/', authorize(['inventory.read']), controller.list);
router.get('/:id', authorize(['inventory.read']), controller.get);
router.post('/', authorize(['inventory.create']), controller.create);
router.put('/:id', authorize(['inventory.create']), controller.update);
router.post('/:id/refresh', authorize(['inventory.create']), controller.refresh);
router.post('/:id/post', authorize(['inventory.create']), controller.post);
router.post('/:id/cancel', authorize(['inventory.create']), controller.cancel);

export default router;
