export type MediaStoragePutInput = {
  storageKey: string;
  data: Buffer;
};

export interface MediaStorage {
  put(input: MediaStoragePutInput): Promise<void>;
  delete(storageKey: string): Promise<void>;
  getUrl(storageKey: string): string | Promise<string>;
  read(storageKey: string): Promise<Buffer>;
}

const STORAGE_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

export function assertValidStorageKey(storageKey: string): void {
  if (!STORAGE_KEY_PATTERN.test(storageKey)) {
    throw new InvalidStorageKeyError();
  }
}

export class InvalidStorageKeyError extends Error {
  constructor() {
    super('Clave de almacenamiento inválida');
    this.name = 'InvalidStorageKeyError';
  }
}

export class MediaStorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaStorageConfigurationError';
  }
}
