import { randomUUID } from 'node:crypto';
import { MediaAsset, MediaAssetStatus, Prisma, PrismaClient } from '@prisma/client';
import prisma from '../../lib/prisma';
import { validateMediaImage } from './imageValidation';
import { MediaStorage } from './mediaStorage';
import { getMediaStorage } from './mediaStorageProvider';

export type MediaAssetRecord = Pick<
  MediaAsset,
  'id' | 'storageKey' | 'mimeType' | 'byteSize' | 'width' | 'height' | 'checksumSha256'
>;

export type MediaAssetCreateData = Omit<MediaAssetRecord, 'id'> & {
  uploadedById: number;
};

export interface MediaAssetRepository {
  createUnattached(data: MediaAssetCreateData): Promise<MediaAssetRecord>;
}

export type UploadedMenuImageDto = {
  assetId: number;
  url: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
};

export class MediaAssetNotFoundError extends Error {
  constructor() {
    super('El asset de imagen indicado no existe');
    this.name = 'MediaAssetNotFoundError';
  }
}

export class MediaAssetUnavailableError extends Error {
  constructor() {
    super('El asset de imagen no está disponible para este plato');
    this.name = 'MediaAssetUnavailableError';
  }
}

export function createPrismaMediaAssetRepository(
  client: PrismaClient = prisma,
): MediaAssetRepository {
  return {
    createUnattached(data) {
      return client.mediaAsset.create({
        data: {
          ...data,
          status: MediaAssetStatus.UNATTACHED,
        },
        select: {
          id: true,
          storageKey: true,
          mimeType: true,
          byteSize: true,
          width: true,
          height: true,
          checksumSha256: true,
        },
      });
    },
  };
}

export async function uploadMenuImage(
  input: { data: Buffer; declaredMimeType?: string; uploadedById: number },
  dependencies: {
    storage?: MediaStorage;
    repository?: MediaAssetRepository;
  } = {},
): Promise<UploadedMenuImageDto> {
  const storage = dependencies.storage || getMediaStorage();
  const repository = dependencies.repository || createPrismaMediaAssetRepository();
  const image = await validateMediaImage(input.data, input.declaredMimeType);
  const storageKey = `${randomUUID()}.${image.extension}`;

  await storage.put({ storageKey, data: image.data });

  let asset: MediaAssetRecord;
  try {
    asset = await repository.createUnattached({
      storageKey,
      mimeType: image.mimeType,
      byteSize: image.byteSize,
      width: image.width,
      height: image.height,
      checksumSha256: image.checksumSha256,
      uploadedById: input.uploadedById,
    });
  } catch (error) {
    try {
      await storage.delete(storageKey);
    } catch (cleanupError) {
      console.error('No fue posible compensar un upload de medios fallido:', cleanupError);
    }
    throw error;
  }

  return {
    assetId: asset.id,
    url: await storage.getUrl(asset.storageKey),
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    byteSize: asset.byteSize,
  };
}

type TransactionClient = Prisma.TransactionClient;

export async function assertMediaAssetAttachable(
  tx: TransactionClient,
  assetId: number,
  currentMenuItemId?: number,
): Promise<void> {
  const asset = await tx.mediaAsset.findUnique({
    where: { id: assetId },
    select: {
      status: true,
      mimeType: true,
      menuItem: { select: { id: true } },
    },
  });

  if (!asset) throw new MediaAssetNotFoundError();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)) {
    throw new MediaAssetUnavailableError();
  }
  if (asset.status === MediaAssetStatus.PENDING_DELETE) {
    throw new MediaAssetUnavailableError();
  }
  if (asset.menuItem && asset.menuItem.id !== currentMenuItemId) {
    throw new MediaAssetUnavailableError();
  }
  if (asset.status === MediaAssetStatus.ATTACHED && !asset.menuItem) {
    throw new MediaAssetUnavailableError();
  }
}

export async function markMediaAssetAttached(
  tx: TransactionClient,
  assetId: number,
): Promise<void> {
  const result = await tx.mediaAsset.updateMany({
    where: { id: assetId, status: MediaAssetStatus.UNATTACHED },
    data: {
      status: MediaAssetStatus.ATTACHED,
      attachedAt: new Date(),
      cleanupRequestedAt: null,
      cleanupAttempts: 0,
      lastCleanupError: null,
    },
  });
  if (result.count !== 1) {
    throw new MediaAssetUnavailableError();
  }
}

export async function markMediaAssetPendingDelete(
  tx: TransactionClient,
  assetId: number,
): Promise<void> {
  await tx.mediaAsset.update({
    where: { id: assetId },
    data: {
      status: MediaAssetStatus.PENDING_DELETE,
      cleanupRequestedAt: new Date(),
      lastCleanupError: null,
    },
  });
}

export async function cleanupPendingMediaAsset(
  assetId: number,
  dependencies: { storage?: MediaStorage; client?: PrismaClient } = {},
): Promise<boolean> {
  const storage = dependencies.storage || getMediaStorage();
  const client = dependencies.client || prisma;
  const asset = await client.mediaAsset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      storageKey: true,
      status: true,
      menuItem: { select: { id: true } },
    },
  });

  if (!asset || asset.status !== MediaAssetStatus.PENDING_DELETE || asset.menuItem) {
    return false;
  }

  try {
    await storage.delete(asset.storageKey);
  } catch (error) {
    await client.mediaAsset.updateMany({
      where: { id: asset.id, status: MediaAssetStatus.PENDING_DELETE },
      data: {
        cleanupAttempts: { increment: 1 },
        lastCleanupError: 'No fue posible eliminar el objeto almacenado',
      },
    });
    return false;
  }

  await client.mediaAsset.deleteMany({
    where: {
      id: asset.id,
      status: MediaAssetStatus.PENDING_DELETE,
      menuItem: null,
    },
  });
  return true;
}
