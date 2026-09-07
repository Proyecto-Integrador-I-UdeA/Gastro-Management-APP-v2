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

export class InvalidStorageKeyError extends Error {
  constructor() {
    super('Clave de almacenamiento inválida');
    this.name = 'InvalidStorageKeyError';
  }
}
