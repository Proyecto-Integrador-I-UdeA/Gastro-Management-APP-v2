import { afterEach, describe, expect, it } from 'vitest';
import { InvalidStorageKeyError, MediaStorageConfigurationError } from '../../src/services/media/mediaStorage';
import { getMediaStorage } from '../../src/services/media/mediaStorageProvider';
import {
  R2MediaStorage,
  R2ObjectClient,
  r2ConfigFromEnv,
} from '../../src/services/media/r2MediaStorage';

const STORAGE_KEY = 'b7e40a5b-cf9a-4aa6-9d31-518aa0a4f15a.png';

const envKeys = [
  'MEDIA_STORAGE_DRIVER',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_ACCOUNT_ID',
  'R2_ENDPOINT',
  'R2_PUBLIC_BASE_URL',
  'NODE_ENV',
] as const;

const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));

afterEach(() => {
  for (const key of envKeys) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function memoryClient(): R2ObjectClient & { objects: Map<string, Buffer> } {
  const objects = new Map<string, Buffer>();
  return {
    objects,
    async put({ key, body }) {
      objects.set(key, Buffer.from(body));
    },
    async delete(key) {
      objects.delete(key);
    },
    async get(key) {
      const value = objects.get(key);
      return value ? Buffer.from(value) : null;
    },
  };
}

describe('R2MediaStorage', () => {
  it('guarda, lee y publica la URL del bucket', async () => {
    const client = memoryClient();
    const storage = new R2MediaStorage({
      bucket: 'gastro-management-media',
      endpoint: 'https://example.r2.cloudflarestorage.com',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      publicBaseUrl: 'https://pub-example.r2.dev',
    }, client);
    const data = Buffer.from('foto');

    await storage.put({ storageKey: STORAGE_KEY, data });

    expect(client.objects.get(STORAGE_KEY)).toEqual(data);
    expect(await storage.read(STORAGE_KEY)).toEqual(data);
    expect(storage.getUrl(STORAGE_KEY)).toBe(`https://pub-example.r2.dev/${STORAGE_KEY}`);

    await storage.delete(STORAGE_KEY);
    await expect(storage.read(STORAGE_KEY)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('sirve la imagen por el backend cuando no hay URL pública', () => {
    const storage = new R2MediaStorage({
      bucket: 'gastro-management-media',
      endpoint: 'https://example.r2.cloudflarestorage.com',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    }, memoryClient());

    expect(storage.getUrl(STORAGE_KEY)).toBe(`/menu-media/files/${STORAGE_KEY}`);
  });

  it.each([
    '../secreto.png',
    'foto-del-usuario.png',
    'b7e40a5b-cf9a-4aa6-9d31-518aa0a4f15a.exe',
  ])('rechaza claves manipulables: %s', async storageKey => {
    const storage = new R2MediaStorage({
      bucket: 'gastro-management-media',
      endpoint: 'https://example.r2.cloudflarestorage.com',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    }, memoryClient());

    await expect(storage.put({ storageKey, data: Buffer.from('x') })).rejects.toBeInstanceOf(InvalidStorageKeyError);
  });
});

describe('r2ConfigFromEnv', () => {
  it('arma el endpoint con el account id y exige las credenciales', () => {
    expect(r2ConfigFromEnv({
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET_NAME: 'gastro-management-media',
      R2_ACCOUNT_ID: 'account',
      R2_PUBLIC_BASE_URL: 'https://pub-example.r2.dev/',
    })).toEqual({
      bucket: 'gastro-management-media',
      endpoint: 'https://account.r2.cloudflarestorage.com',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      publicBaseUrl: 'https://pub-example.r2.dev',
    });

    expect(() => r2ConfigFromEnv({})).toThrow(MediaStorageConfigurationError);
  });
});

describe('getMediaStorage con R2', () => {
  it('usa R2 en producción y mantiene el rechazo del disco local', () => {
    process.env.NODE_ENV = 'production';
    process.env.MEDIA_STORAGE_DRIVER = 'local';
    expect(() => getMediaStorage()).toThrow(/no está permitido en producción/);

    process.env.MEDIA_STORAGE_DRIVER = 'r2';
    process.env.R2_ACCESS_KEY_ID = 'key';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET_NAME = 'gastro-management-media';
    process.env.R2_ENDPOINT = 'https://account.r2.cloudflarestorage.com';
    process.env.R2_PUBLIC_BASE_URL = 'https://pub-example.r2.dev';

    const storage = getMediaStorage();
    expect(storage).toBeInstanceOf(R2MediaStorage);
    expect(storage.getUrl(STORAGE_KEY)).toBe(`https://pub-example.r2.dev/${STORAGE_KEY}`);
  });
});
