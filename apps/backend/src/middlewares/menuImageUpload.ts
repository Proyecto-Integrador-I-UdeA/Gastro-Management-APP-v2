import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { MAX_IMAGE_BYTES } from '../services/media/imageValidation';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
    fields: 0,
  },
});

const uploadSingleImage = upload.single('image');

export function parseMenuImageUpload(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  uploadSingleImage(req, res, error => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'La imagen excede el límite de 5 MiB' });
        return;
      }
      res.status(400).json({ error: 'La solicitud multipart de imagen no es válida' });
      return;
    }

    console.error('Error procesando upload multipart:', error);
    res.status(400).json({ error: 'La solicitud multipart de imagen no es válida' });
  });
}
