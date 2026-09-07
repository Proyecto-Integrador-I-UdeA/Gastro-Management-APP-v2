import { MediaAssetStatus } from '@prisma/client';
import { Response } from 'express';
import prisma from '../../lib/prisma';
import { AuthenticatedRequest } from '../../middlewares/auth';
import { InvalidMediaImageError } from '../../services/media/imageValidation';
import { InvalidStorageKeyError } from '../../services/media/mediaStorage';
import {
  MediaStorageConfigurationError,
  getMediaStorage,
} from '../../services/media/mediaStorageProvider';
import { uploadMenuImage } from '../../services/media/menuMediaService';

export async function uploadMenuItemImage(
  req: AuthenticatedRequest,
  res: Response,
) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Debe adjuntar una imagen en el campo image' });
  }

  try {
    const result = await uploadMenuImage({
      data: req.file.buffer,
      declaredMimeType: req.file.mimetype,
      uploadedById: req.user.id,
    });
    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof InvalidMediaImageError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof MediaStorageConfigurationError) {
      console.error('Configuración de almacenamiento de medios inválida:', error.message);
      return res.status(503).json({ error: 'El almacenamiento de imágenes no está disponible' });
    }

    console.error('Error almacenando imagen de menú:', error);
    return res.status(500).json({ error: 'No fue posible almacenar la imagen' });
  }
}

export async function serveMenuMediaFile(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const asset = await prisma.mediaAsset.findUnique({
      where: { storageKey: req.params.storageKey },
      select: { storageKey: true, mimeType: true, status: true },
    });
    if (!asset || asset.status === MediaAssetStatus.PENDING_DELETE) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    const data = await getMediaStorage().read(asset.storageKey);
    res.set({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': String(data.length),
      'Content-Type': asset.mimeType,
      'X-Content-Type-Options': 'nosniff',
    });
    return res.send(data);
  } catch (error) {
    if (error instanceof InvalidStorageKeyError) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }
    if (error instanceof MediaStorageConfigurationError) {
      return res.status(503).json({ error: 'El almacenamiento de imágenes no está disponible' });
    }

    console.error('Error sirviendo imagen de menú:', error);
    return res.status(500).json({ error: 'No fue posible obtener la imagen' });
  }
}
