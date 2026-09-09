import { Router } from 'express';
import {
  acknowledgeCancellation,
  getDispatch,
  listDispatches,
  updateDispatchStatus,
} from '../../controllers/kitchen/kitchenDispatchController';
import { authenticate, authorize } from '../../middlewares/auth';

const router = Router();

router.get('/dispatches', authenticate, authorize(['kitchen.read']), listDispatches);
router.get('/dispatches/:dispatchId', authenticate, authorize(['kitchen.read']), getDispatch);
router.patch(
  '/dispatches/:dispatchId/status',
  authenticate,
  authorize(['kitchen.manage']),
  updateDispatchStatus,
);
router.post(
  '/cancellations/:orderId/acknowledge',
  authenticate,
  authorize(['kitchen.manage']),
  acknowledgeCancellation,
);

export default router;
