import { Router } from 'express';
import {
  serveMenuMediaFile,
  uploadMenuItemImage,
} from '../../controllers/menu/menuMediaController';
import { authenticate, authorize } from '../../middlewares/auth';
import { parseMenuImageUpload } from '../../middlewares/menuImageUpload';

const router = Router();

router.get('/files/:storageKey', serveMenuMediaFile);
router.post(
  '/images',
  authenticate,
  authorize(['menu.manage']),
  parseMenuImageUpload,
  uploadMenuItemImage,
);

export default router;
