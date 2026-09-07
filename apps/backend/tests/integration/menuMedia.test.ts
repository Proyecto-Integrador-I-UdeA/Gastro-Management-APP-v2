import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';
import { LocalMediaStorage } from '../../src/services/media/localMediaStorage';
import { setMediaStorageForTests } from '../../src/services/media/mediaStorageProvider';
import { MAX_IMAGE_BYTES } from '../../src/services/media/imageValidation';
import { createIntegrationToken } from './authToken';

const PREFIX = '__menu_sales_01b__';
let storageRoot: string;
let storage: LocalMediaStorage;

async function clearFixtures() {
  const menuItems = await prisma.menuItem.findMany({
    where: { name: { startsWith: PREFIX } },
    select: { id: true },
  });
  if (menuItems.length > 0) {
    await prisma.menuItemComponent.deleteMany({
      where: { menuItemId: { in: menuItems.map(item => item.id) } },
    });
    await prisma.menuItem.deleteMany({
      where: { id: { in: menuItems.map(item => item.id) } },
    });
  }

  const assets = await prisma.mediaAsset.findMany({
    where: { storageKey: { startsWith: '' }, uploadedBy: { email: { startsWith: PREFIX } } },
    select: { id: true, storageKey: true },
  });
  await Promise.all(assets.map(asset => storage.delete(asset.storageKey)));
  if (assets.length > 0) {
    await prisma.mediaAsset.deleteMany({ where: { id: { in: assets.map(asset => asset.id) } } });
  }
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
}

async function createActor(suffix: string) {
  const actor = await prisma.user.create({
    data: {
      email: `${PREFIX}${suffix}@example.test`,
      passwordHash: 'not-used-by-test',
    },
  });
  return {
    actor,
    token: createIntegrationToken(['menu.manage'], actor.id),
  };
}

async function createImage(format: 'jpeg' | 'png' | 'webp' = 'png') {
  return sharp({
    create: {
      width: 12,
      height: 9,
      channels: 3,
      background: '#1863b4',
    },
  })[format]().toBuffer();
}

async function uploadImage(token: string, suffix: string, format: 'jpeg' | 'png' | 'webp' = 'png') {
  const mimeTypes = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  return request(app)
    .post('/menu-media/images')
    .set('Authorization', `Bearer ${token}`)
    .attach('image', await createImage(format), {
      filename: `../../${PREFIX}${suffix}.${format}`,
      contentType: mimeTypes[format],
    });
}

beforeAll(async () => {
  storageRoot = await mkdtemp(join(tmpdir(), 'gma-menu-media-integration-'));
  storage = new LocalMediaStorage({ rootDirectory: storageRoot });
  setMediaStorageForTests(storage);
});
beforeEach(clearFixtures);
afterEach(clearFixtures);
afterAll(async () => {
  setMediaStorageForTests(undefined);
  await rm(storageRoot, { recursive: true, force: true });
  await prisma.$disconnect();
});

describe('MENU-SALES-01B: imágenes comerciales de MenuItem', () => {
  it('protege upload con autenticación y menu.manage antes de procesar multipart', async () => {
    const image = await createImage();
    expect((await request(app)
      .post('/menu-media/images')
      .attach('image', image, { filename: 'menu.png', contentType: 'image/png' })).status).toBe(401);
    expect((await request(app)
      .post('/menu-media/images')
      .set('Authorization', `Bearer ${createIntegrationToken([])}`)
      .attach('image', image, { filename: 'menu.png', contentType: 'image/png' })).status).toBe(403);
  });

  it('crea MediaAsset UNATTACHED, usa clave aleatoria y no expone storage interno', async () => {
    const { actor, token } = await createActor('upload');
    const response = await uploadImage(token, 'nombre-controlado');

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      mimeType: 'image/png',
      width: 12,
      height: 9,
    });
    expect(response.body).not.toHaveProperty('storageKey');
    expect(response.body.url).toMatch(/^\/menu-media\/files\/[0-9a-f-]{36}\.png$/);
    expect(response.body.url).not.toContain('nombre-controlado');
    expect(response.body.url).not.toContain(storageRoot);

    const persisted = await prisma.mediaAsset.findUniqueOrThrow({
      where: { id: response.body.assetId },
    });
    expect(persisted).toMatchObject({
      uploadedById: actor.id,
      status: 'UNATTACHED',
      mimeType: 'image/png',
      width: 12,
      height: 9,
    });
    expect(persisted.storageKey).not.toContain('nombre-controlado');

    const served = await request(app).get(response.body.url);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toMatch(/^image\/png/);
    expect(served.headers['x-content-type-options']).toBe('nosniff');
  });

  it('rechaza exceso de 5 MiB, MIME falso, contenido no imagen, SVG y archivo corrupto', async () => {
    const { token } = await createActor('invalid');
    const oversized = await request(app)
      .post('/menu-media/images')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.alloc(MAX_IMAGE_BYTES + 1), {
        filename: 'large.jpg',
        contentType: 'image/jpeg',
      });
    expect(oversized.status).toBe(413);

    const png = await createImage('png');
    expect((await request(app)
      .post('/menu-media/images')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', png, { filename: 'fake.jpg', contentType: 'image/jpeg' })).status).toBe(400);
    expect((await request(app)
      .post('/menu-media/images')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('not an image'), {
        filename: 'fake.png',
        contentType: 'image/png',
      })).status).toBe(400);
    expect((await request(app)
      .post('/menu-media/images')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), {
        filename: 'vector.svg',
        contentType: 'image/svg+xml',
      })).status).toBe(400);
    const jpeg = await createImage('jpeg');
    expect((await request(app)
      .post('/menu-media/images')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', jpeg.subarray(0, Math.floor(jpeg.length / 2)), {
        filename: 'broken.jpg',
        contentType: 'image/jpeg',
      })).status).toBe(400);
  });

  it('asocia una imagen al crear y devuelve un resumen administrativo controlado', async () => {
    const { token } = await createActor('attach');
    const uploaded = await uploadImage(token, 'attach');
    const response = await request(app)
      .post('/menu-items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `${PREFIX}plato con imagen`,
        imageAssetId: uploaded.body.assetId,
        components: [],
      });

    expect(response.status).toBe(200);
    expect(response.body.image).toEqual({
      assetId: uploaded.body.assetId,
      url: uploaded.body.url,
      width: 12,
      height: 9,
    });
    expect(response.body).not.toHaveProperty('imageAsset');
    expect(response.body).not.toHaveProperty('imageAssetId');
    expect(response.body.image).not.toHaveProperty('storageKey');
    expect(await prisma.mediaAsset.findUniqueOrThrow({
      where: { id: uploaded.body.assetId },
      select: { status: true, menuItem: { select: { id: true } } },
    })).toEqual({ status: 'ATTACHED', menuItem: { id: response.body.id } });
  });

  it('reemplaza después del commit y elimina el asset anterior', async () => {
    const { token } = await createActor('replace');
    const first = await uploadImage(token, 'first', 'jpeg');
    const created = await request(app)
      .post('/menu-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${PREFIX}reemplazo`, imageAssetId: first.body.assetId });
    const second = await uploadImage(token, 'second', 'webp');

    const replaced = await request(app)
      .put(`/menu-items/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ imageAssetId: second.body.assetId });

    expect(replaced.status).toBe(200);
    expect(replaced.body.image.assetId).toBe(second.body.assetId);
    expect(await prisma.menuItem.findUniqueOrThrow({
      where: { id: created.body.id },
      select: { imageAssetId: true },
    })).toEqual({ imageAssetId: second.body.assetId });
    expect(await prisma.mediaAsset.findUnique({ where: { id: first.body.assetId } })).toBeNull();
    expect((await request(app).get(first.body.url)).status).toBe(404);
    expect((await request(app).get(second.body.url)).status).toBe(200);
  });

  it('mantiene la nueva referencia activa y marca el asset anterior si falla borrar el archivo', async () => {
    const { token } = await createActor('cleanup-failure');
    const first = await uploadImage(token, 'cleanup-first');
    const created = await request(app)
      .post('/menu-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${PREFIX}fallo limpieza`, imageAssetId: first.body.assetId });
    const second = await uploadImage(token, 'cleanup-second');
    setMediaStorageForTests({
      put: input => storage.put(input),
      read: key => storage.read(key),
      getUrl: key => storage.getUrl(key),
      delete: async () => {
        throw new Error('fallo de storage simulado');
      },
    });

    let response;
    try {
      response = await request(app)
        .put(`/menu-items/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ imageAssetId: second.body.assetId });
    } finally {
      setMediaStorageForTests(storage);
    }

    expect(response.status).toBe(200);
    expect(response.body.image.assetId).toBe(second.body.assetId);
    expect(await prisma.menuItem.findUniqueOrThrow({
      where: { id: created.body.id },
      select: { imageAssetId: true },
    })).toEqual({ imageAssetId: second.body.assetId });
    expect(await prisma.mediaAsset.findUniqueOrThrow({
      where: { id: first.body.assetId },
      select: { status: true, cleanupAttempts: true, lastCleanupError: true },
    })).toEqual({
      status: 'PENDING_DELETE',
      cleanupAttempts: 1,
      lastCleanupError: 'No fue posible eliminar el objeto almacenado',
    });
  });

  it('elimina la asociación, mantiene null de forma idempotente y limpia el asset', async () => {
    const { token } = await createActor('delete');
    const uploaded = await uploadImage(token, 'delete');
    const created = await request(app)
      .post('/menu-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${PREFIX}eliminación`, imageAssetId: uploaded.body.assetId });

    expect((await request(app)
      .delete(`/menu-items/${created.body.id}/image`)).status).toBe(401);
    expect((await request(app)
      .delete(`/menu-items/${created.body.id}/image`)
      .set('Authorization', `Bearer ${createIntegrationToken([])}`)).status).toBe(403);

    const removed = await request(app)
      .delete(`/menu-items/${created.body.id}/image`)
      .set('Authorization', `Bearer ${token}`);
    expect(removed.status).toBe(200);
    expect(removed.body.image).toBeNull();
    expect(await prisma.mediaAsset.findUnique({ where: { id: uploaded.body.assetId } })).toBeNull();

    const repeated = await request(app)
      .delete(`/menu-items/${created.body.id}/image`)
      .set('Authorization', `Bearer ${token}`);
    expect(repeated.status).toBe(200);
    expect(repeated.body.image).toBeNull();
  });

  it('impide asociar un mismo asset a varios platos y no modifica el segundo', async () => {
    const { token } = await createActor('unique');
    const uploaded = await uploadImage(token, 'unique');
    const first = await request(app)
      .post('/menu-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${PREFIX}primero`, imageAssetId: uploaded.body.assetId });
    const second = await prisma.menuItem.create({ data: { name: `${PREFIX}segundo` } });

    const response = await request(app)
      .put(`/menu-items/${second.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ imageAssetId: uploaded.body.assetId });

    expect(response.status).toBe(409);
    expect(await prisma.menuItem.findUniqueOrThrow({
      where: { id: second.id },
      select: { imageAssetId: true },
    })).toEqual({ imageAssetId: null });
    expect(await prisma.menuItem.findUniqueOrThrow({
      where: { id: first.body.id },
      select: { imageAssetId: true },
    })).toEqual({ imageAssetId: uploaded.body.assetId });
  });

  it('rechaza imageAssetId inexistente o con tipo inválido sin crear el plato', async () => {
    const { token } = await createActor('invalid-reference');
    const missing = await request(app)
      .post('/menu-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${PREFIX}asset inexistente`, imageAssetId: 2_147_483_000 });
    expect(missing.status).toBe(400);

    const malformed = await request(app)
      .post('/menu-items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${PREFIX}asset inválido`, imageAssetId: '../image.png' });
    expect(malformed.status).toBe(400);
    expect(await prisma.menuItem.count({
      where: { name: { startsWith: `${PREFIX}asset ` } },
    })).toBe(0);
  });

  it('mantiene MenuItems legacy con imageAssetId null y placeholder implícito', async () => {
    const legacy = await prisma.menuItem.create({
      data: { name: `${PREFIX}legacy sin imagen` },
    });
    const response = await request(app)
      .get(`/menu-items/${legacy.id}`)
      .set('Authorization', `Bearer ${createIntegrationToken(['menu.read'])}`);

    expect(response.status).toBe(200);
    expect(response.body.image).toBeNull();
    expect(await prisma.menuItem.findUniqueOrThrow({
      where: { id: legacy.id },
      select: { imageAssetId: true },
    })).toEqual({ imageAssetId: null });
  });
});
