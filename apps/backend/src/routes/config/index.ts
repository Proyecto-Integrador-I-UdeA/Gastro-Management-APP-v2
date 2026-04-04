import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { createConfig, getConfigs } from '../../controllers/config/configController';

const router = Router();

router.get('/', authenticate, getConfigs);
router.post('/', authenticate, createConfig);

export default router;