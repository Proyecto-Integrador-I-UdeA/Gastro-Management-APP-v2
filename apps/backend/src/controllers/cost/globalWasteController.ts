import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../middlewares/auth';
import { globalWasteInputSchema } from '../../schemas/globalWasteSchema';
import {
  getGlobalWasteConfig,
  updateGlobalWasteConfig,
} from '../../services/pricing/globalWasteService';

export async function getGlobalWaste(_req: AuthenticatedRequest, res: Response) {
  try {
    return res.json(await getGlobalWasteConfig());
  } catch (error) {
    console.error('Error consultando la merma general:', error);
    return res.status(500).json({ error: 'No se pudo consultar la merma general' });
  }
}

export async function updateGlobalWaste(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const parsed = globalWasteInputSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: 'La merma general debe ser un porcentaje entre 0 y 100',
      code: 'VALIDATION_ERROR',
      details: parsed.error.issues,
    });
  }
  try {
    return res.json(await updateGlobalWasteConfig(parsed.data.wastePercent, req.user.id));
  } catch (error) {
    console.error('Error actualizando la merma general:', error);
    return res.status(500).json({ error: 'No se pudo actualizar la merma general' });
  }
}
