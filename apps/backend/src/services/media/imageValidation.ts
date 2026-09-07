import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { Metadata } from 'sharp';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 10_000;
export const MAX_IMAGE_PIXELS = 40_000_000;

type SupportedImageFormat = 'jpeg' | 'png' | 'webp';

const imageFormats: Record<SupportedImageFormat, { mimeType: string; extension: string }> = {
  jpeg: { mimeType: 'image/jpeg', extension: 'jpg' },
  png: { mimeType: 'image/png', extension: 'png' },
  webp: { mimeType: 'image/webp', extension: 'webp' },
};

const declaredMimeAliases: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/jpeg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
};

export class InvalidMediaImageError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 413 = 400,
  ) {
    super(message);
    this.name = 'InvalidMediaImageError';
  }
}

export type ValidatedMediaImage = {
  data: Buffer;
  mimeType: string;
  extension: string;
  byteSize: number;
  width: number;
  height: number;
  checksumSha256: string;
};

export async function validateMediaImage(
  data: Buffer,
  declaredMimeType: string | undefined,
): Promise<ValidatedMediaImage> {
  if (data.length === 0) {
    throw new InvalidMediaImageError('La imagen está vacía');
  }
  if (data.length > MAX_IMAGE_BYTES) {
    throw new InvalidMediaImageError('La imagen excede el límite de 5 MiB', 413);
  }

  const normalizedDeclaredMime = declaredMimeType
    ? declaredMimeAliases[declaredMimeType.trim().toLowerCase()]
    : undefined;
  if (!normalizedDeclaredMime) {
    throw new InvalidMediaImageError('El tipo de archivo declarado no está permitido');
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(data, {
      failOn: 'error',
      limitInputPixels: MAX_IMAGE_PIXELS,
    }).metadata();
  } catch {
    throw new InvalidMediaImageError('El archivo no es una imagen válida');
  }

  const format = metadata.format as SupportedImageFormat | undefined;
  const descriptor = format ? imageFormats[format] : undefined;
  if (!descriptor) {
    throw new InvalidMediaImageError('La imagen debe ser JPEG, PNG o WebP');
  }
  if (normalizedDeclaredMime !== descriptor.mimeType) {
    throw new InvalidMediaImageError(
      'El tipo de archivo declarado no coincide con el contenido de la imagen',
    );
  }
  if (!metadata.width || !metadata.height) {
    throw new InvalidMediaImageError('No fue posible determinar las dimensiones de la imagen');
  }
  if (
    metadata.width > MAX_IMAGE_DIMENSION
    || metadata.height > MAX_IMAGE_DIMENSION
    || metadata.width * metadata.height > MAX_IMAGE_PIXELS
  ) {
    throw new InvalidMediaImageError('Las dimensiones de la imagen exceden el límite permitido');
  }
  if ((metadata.pages || 1) !== 1) {
    throw new InvalidMediaImageError('Las imágenes animadas o multipágina no están permitidas');
  }

  try {
    await sharp(data, {
      failOn: 'error',
      limitInputPixels: MAX_IMAGE_PIXELS,
    }).stats();
  } catch {
    throw new InvalidMediaImageError('El archivo de imagen está corrupto');
  }

  return {
    data,
    mimeType: descriptor.mimeType,
    extension: descriptor.extension,
    byteSize: data.length,
    width: metadata.width,
    height: metadata.height,
    checksumSha256: createHash('sha256').update(data).digest('hex'),
  };
}
