import { constants } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { InvalidStorageKeyError, MediaStorage, MediaStoragePutInput } from './mediaStorage';

const STORAGE_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

export const DEFAULT_LOCAL_MEDIA_ROOT = join(
  process.env.LOCALAPPDATA || homedir(),
  'GastroManagement',
  'media',
);

function normalizeBaseUrl(baseUrl: string | undefined): string {
  return (baseUrl || '').trim().replace(/\/+$/, '');
}

export class LocalMediaStorage implements MediaStorage {
  readonly rootDirectory: string;
  private readonly publicBaseUrl: string;

  constructor(options: { rootDirectory?: string; publicBaseUrl?: string } = {}) {
    this.rootDirectory = resolve(options.rootDirectory || DEFAULT_LOCAL_MEDIA_ROOT);
    this.publicBaseUrl = normalizeBaseUrl(options.publicBaseUrl);
  }

  private resolveStoragePath(storageKey: string): string {
    if (!STORAGE_KEY_PATTERN.test(storageKey)) {
      throw new InvalidStorageKeyError();
    }

    const storagePath = resolve(this.rootDirectory, storageKey);
    if (dirname(storagePath) !== this.rootDirectory) {
      throw new InvalidStorageKeyError();
    }
    return storagePath;
  }

  async put({ storageKey, data }: MediaStoragePutInput): Promise<void> {
    const storagePath = this.resolveStoragePath(storageKey);
    await mkdir(this.rootDirectory, { recursive: true });
    await writeFile(storagePath, data, {
      flag: 'wx',
      mode: constants.S_IRUSR | constants.S_IWUSR,
    });
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await unlink(this.resolveStoragePath(storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  getUrl(storageKey: string): string {
    this.resolveStoragePath(storageKey);
    return `${this.publicBaseUrl}/menu-media/files/${encodeURIComponent(storageKey)}`;
  }

  read(storageKey: string): Promise<Buffer> {
    return readFile(this.resolveStoragePath(storageKey));
  }
}
