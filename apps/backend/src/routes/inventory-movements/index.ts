import { Router, Request, Response, NextFunction } from 'express';
import { MovementType } from '@prisma/client';
import {
  authenticate,
  authorize,
  authorizeAny,
} from '../../middlewares/auth';
import {
  listInventoryMovements,
  getInventoryMovementById,
  createInventoryMovement,
  patchTransferMovement,
  deleteTransferMovement,
} from '../../controllers/inventoryMovement/inventoryMovementController';

const router = Router();

const authorizeCreateMovement = (req: Request, res: Response, next: NextFunction) => {
  const type = req.body?.type as MovementType | undefined;
  if (type === MovementType.TRANSFER) {
    return authorize(['transfers.create'])(req, res, next);
  }
  if (type === MovementType.PURCHASE) {
    return authorizeAny(['transfers.create', 'inventory.create'])(req, res, next);
  }
  return authorize(['inventory.create'])(req, res, next);
};

router.get(
  '/',
  authenticate,
  authorizeAny(['inventory.read', 'transfers.read']),
  listInventoryMovements
);
router.get(
  '/:id',
  authenticate,
  authorizeAny(['inventory.read', 'transfers.read']),
  getInventoryMovementById
);
router.post('/', authenticate, authorizeCreateMovement, createInventoryMovement);
router.patch('/:id', authenticate, authorize(['transfers.update']), patchTransferMovement);
router.delete('/:id', authenticate, authorize(['transfers.delete']), deleteTransferMovement);

export default router;
