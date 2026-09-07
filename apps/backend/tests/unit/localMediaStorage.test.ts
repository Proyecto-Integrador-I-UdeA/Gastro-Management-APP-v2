import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalMediaStorage } from '../../src/services/media/localMediaStorage';
import { InvalidStorageKeyError } from '../../src/services/media/mediaStorage';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => (
    rm(directory, { recursive: true, force: true })
  )));
});

describe('LocalMediaStorage', () => {
  it('guarda fuera del repositorio configurado y nunca devuelve la ruta física', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'gma-media-storage-'));
    temporaryDirectories.push(rootDirectory);
    const storage = new LocalMediaStorage({
      rootDirectory,
      publicBaseUrl: 'http://localhost:3001/',
    });
    const storageKey = 'b7e40a5b-cf9a-4aa6-9d31-518aa0a4f15a.png';
    const data = Buffer.from('contenido de prueba');

    await storage.put({ storageKey, data });

    expect(await readFile(join(rootDirectory, storageKey))).toEqual(data);
    expect(await storage.read(storageKey)).toEqual(data);
    expect(storage.getUrl(storageKey)).toBe(
      `http://localhost:3001/menu-media/files/${storageKey}`,
    );
    expect(storage.getUrl(storageKey)).not.toContain(rootDirectory);

    await storage.delete(storageKey);
    await expect(storage.read(storageKey)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(storage.delete(storageKey)).resolves.toBeUndefined();
  });

  it.each([
    '../secreto.png',
    '..\\secreto.png',
    'foto-del-usuario.png',
    'b7e40a5b-cf9a-4aa6-9d31-518aa0a4f15a.exe',
  ])('rechaza claves manipulables: %s', async storageKey => {
    const storage = new LocalMediaStorage({ rootDirectory: tmpdir() });
    await expect(storage.put({
      storageKey,
      data: Buffer.from('x'),
    })).rejects.toBeInstanceOf(InvalidStorageKeyError);
  });
});
