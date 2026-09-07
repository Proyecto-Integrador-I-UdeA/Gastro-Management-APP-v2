import { LocalMediaStorage } from './localMediaStorage';
import { MediaStorage } from './mediaStorage';

export class MediaStorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaStorageConfigurationError';
  }
}

let testStorageOverride: MediaStorage | undefined;

export function setMediaStorageForTests(storage: MediaStorage | undefined): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new MediaStorageConfigurationError(
      'El reemplazo del storage solo está permitido durante pruebas',
    );
  }
  testStorageOverride = storage;
}

export function getMediaStorage(): MediaStorage {
  if (testStorageOverride) return testStorageOverride;

  const driver = (process.env.MEDIA_STORAGE_DRIVER || 'local').trim().toLowerCase();
  if (driver !== 'local') {
    throw new MediaStorageConfigurationError(
      `Driver de medios no soportado: ${driver}`,
    );
  }
  if (process.env.NODE_ENV === 'production') {
    throw new MediaStorageConfigurationError(
      'El driver local de medios no está permitido en producción',
    );
  }

  return new LocalMediaStorage({
    rootDirectory: process.env.MEDIA_LOCAL_ROOT,
    publicBaseUrl: process.env.MEDIA_PUBLIC_BASE_URL,
  });
}
