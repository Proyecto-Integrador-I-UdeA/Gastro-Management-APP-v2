import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  InvalidMediaImageError,
  MAX_IMAGE_BYTES,
  validateMediaImage,
} from '../../src/services/media/imageValidation';

async function createImage(format: 'jpeg' | 'png' | 'webp', width = 8, height = 6) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 24, g: 99, b: 180 },
    },
  })[format]().toBuffer();
}

describe('validación segura de imágenes comerciales', () => {
  it.each([
    ['jpeg', 'image/jpeg', 'jpg'],
    ['png', 'image/png', 'png'],
    ['webp', 'image/webp', 'webp'],
  ] as const)('acepta %s real y conserva exactamente sus bytes', async (format, mimeType, extension) => {
    const data = await createImage(format);
    const result = await validateMediaImage(data, mimeType);

    expect(result).toMatchObject({
      mimeType,
      extension,
      byteSize: data.length,
      width: 8,
      height: 6,
      checksumSha256: createHash('sha256').update(data).digest('hex'),
    });
    expect(result.data.equals(data)).toBe(true);
  });

  it('rechaza archivos superiores a 5 MiB antes de decodificarlos', async () => {
    await expect(validateMediaImage(
      Buffer.alloc(MAX_IMAGE_BYTES + 1),
      'image/jpeg',
    )).rejects.toMatchObject({ statusCode: 413 });
  });

  it('rechaza MIME declarado falso aunque los bytes sean una imagen válida', async () => {
    const png = await createImage('png');
    await expect(validateMediaImage(png, 'image/jpeg')).rejects.toThrow(
      'no coincide con el contenido',
    );
  });

  it('rechaza contenido no imagen, SVG e imagen corrupta', async () => {
    await expect(validateMediaImage(
      Buffer.from('esto no es una imagen'),
      'image/png',
    )).rejects.toBeInstanceOf(InvalidMediaImageError);

    await expect(validateMediaImage(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="5" height="5"/></svg>'),
      'image/svg+xml',
    )).rejects.toBeInstanceOf(InvalidMediaImageError);

    const jpeg = await createImage('jpeg', 64, 64);
    await expect(validateMediaImage(
      jpeg.subarray(0, Math.floor(jpeg.length / 2)),
      'image/jpeg',
    )).rejects.toBeInstanceOf(InvalidMediaImageError);
  });

  it('rechaza dimensiones individuales no razonables', async () => {
    const tooWide = await createImage('png', 10_001, 1);
    await expect(validateMediaImage(tooWide, 'image/png')).rejects.toThrow(
      'dimensiones de la imagen exceden',
    );
  });
});
