import { Router, Request, Response, NextFunction } from 'express';
import { MovementType } from '@prisma/client';
import { authenticate, authorize } from '../../middlewares/auth';
import {
  listInventoryMovements,
  getInventoryMovementById,
  createInventoryMovement,
} from '../../controllers/inventoryMovement/inventoryMovementController';

const router = Router();

const authorizeCreateMovement = (req: Request, res: Response, next: NextFunction) => {
  const type = req.body?.type as MovementType | undefined;
  if (type === MovementType.TRANSFER) {
    return authorize(['transfers.create'])(req, res, next);
  }
  return authorize(['inventory.create'])(req, res, next);
};

router.get('/', authenticate, authorize(['inventory.read']), listInventoryMovements);
router.get('/:id', authenticate, authorize(['inventory.read']), getInventoryMovementById);
router.post('/', authenticate, authorizeCreateMovement, createInventoryMovement);

export default router;
