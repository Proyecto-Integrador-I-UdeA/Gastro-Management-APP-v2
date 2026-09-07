import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import { MediaStorage } from '../../src/services/media/mediaStorage';
import {
  cleanupPendingMediaAsset,
  MediaAssetRepository,
  uploadMenuImage,
} from '../../src/services/media/menuMediaService';

function createStorage(overrides: Partial<MediaStorage> = {}): MediaStorage {
  return {
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    getUrl: vi.fn(key => `/menu-media/files/${key}`),
    read: vi.fn().mockResolvedValue(Buffer.alloc(0)),
    ...overrides,
  };
}

async function createPng() {
  return sharp({
    create: {
      width: 4,
      height: 3,
      channels: 3,
      background: '#1863b4',
    },
  }).png().toBuffer();
}

describe('compensaciones de MediaAsset y storage', () => {
  it('usa una storageKey aleatoria independiente del filename del cliente', async () => {
    const storage = createStorage();
    const repository: MediaAssetRepository = {
      createUnattached: vi.fn(async data => ({ id: 27, ...data })),
    };

    const result = await uploadMenuImage({
      data: await createPng(),
      declaredMimeType: 'image/png',
      uploadedById: 3,
    }, { storage, repository });

    const storedKey = vi.mocked(storage.put).mock.calls[0][0].storageKey;
    expect(storedKey).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(storedKey).not.toContain('nombre-original');
    expect(result).toMatchObject({
      assetId: 27,
      mimeType: 'image/png',
      width: 4,
      height: 3,
    });
    expect(result).not.toHaveProperty('storageKey');
  });

  it('elimina el archivo si crear MediaAsset falla después del put', async () => {
    const storage = createStorage();
    const repository: MediaAssetRepository = {
      createUnattached: vi.fn().mockRejectedValue(new Error('database unavailable')),
    };

    await expect(uploadMenuImage({
      data: await createPng(),
      declaredMimeType: 'image/png',
      uploadedById: 3,
    }, { storage, repository })).rejects.toThrow('database unavailable');

    const storedKey = vi.mocked(storage.put).mock.calls[0][0].storageKey;
    expect(storage.delete).toHaveBeenCalledWith(storedKey);
  });

  it('mantiene PENDING_DELETE detectable si falla borrar el objeto', async () => {
    const storage = createStorage({
      delete: vi.fn().mockRejectedValue(new Error('object storage unavailable')),
    });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const client = {
      mediaAsset: {
        findUnique: vi.fn().mockResolvedValue({
          id: 42,
          storageKey: 'b7e40a5b-cf9a-4aa6-9d31-518aa0a4f15a.webp',
          status: 'PENDING_DELETE',
          menuItem: null,
        }),
        updateMany,
        deleteMany,
      },
    };

    await expect(cleanupPendingMediaAsset(42, {
      storage,
      client: client as never,
    })).resolves.toBe(false);

    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 42, status: 'PENDING_DELETE' },
    }));
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
