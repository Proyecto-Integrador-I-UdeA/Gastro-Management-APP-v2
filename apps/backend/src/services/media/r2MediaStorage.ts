import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  assertValidStorageKey,
  MediaStorage,
  MediaStorageConfigurationError,
  MediaStoragePutInput,
} from './mediaStorage';

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export type R2MediaConfig = {
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
};

export interface R2ObjectClient {
  put(input: { key: string; body: Buffer; contentType: string }): Promise<void>;
  delete(key: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
}

export function r2ConfigFromEnv(env: NodeJS.ProcessEnv = process.env): R2MediaConfig {
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim() ?? '';
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim() ?? '';
  const bucket = env.R2_BUCKET_NAME?.trim() ?? '';
  const accountId = env.R2_ACCOUNT_ID?.trim() ?? '';
  const endpoint = (env.R2_ENDPOINT?.trim() || (
    accountId ? `https://${accountId}.r2.cloudflarestorage.com` : ''
  )).replace(/\/+$/, '');
  const missing: string[] = [];
  if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
  if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
  if (!bucket) missing.push('R2_BUCKET_NAME');
  if (!endpoint) missing.push('R2_ENDPOINT o R2_ACCOUNT_ID');
  if (missing.length > 0) {
    throw new MediaStorageConfigurationError(
      `Faltan variables de R2: ${missing.join(', ')}`,
    );
  }

  const publicBaseUrl = env.R2_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');
  return {
    bucket,
    endpoint,
    accessKeyId,
    secretAccessKey,
    ...(publicBaseUrl ? { publicBaseUrl } : {}),
  };
}

export function createS3R2ObjectClient(config: R2MediaConfig): R2ObjectClient {
  const client = new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  return {
    async put({ key, body, contentType }) {
      await client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }));
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }));
    },
    async get(key) {
      try {
        const response = await client.send(new GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }));
        if (!response.Body) return null;
        return Buffer.from(await response.Body.transformToByteArray());
      } catch (error) {
        if (isMissingObject(error)) return null;
        throw error;
      }
    },
  };
}

export class R2MediaStorage implements MediaStorage {
  constructor(
    private readonly config: R2MediaConfig,
    private readonly objects: R2ObjectClient,
  ) {}

  async put({ storageKey, data }: MediaStoragePutInput): Promise<void> {
    assertValidStorageKey(storageKey);
    await this.objects.put({
      key: storageKey,
      body: data,
      contentType: contentTypeFor(storageKey),
    });
  }

  async delete(storageKey: string): Promise<void> {
    assertValidStorageKey(storageKey);
    await this.objects.delete(storageKey);
  }

  getUrl(storageKey: string): string {
    assertValidStorageKey(storageKey);
    const encodedKey = encodeURIComponent(storageKey);
    if (this.config.publicBaseUrl) {
      return `${this.config.publicBaseUrl}/${encodedKey}`;
    }
    return `/menu-media/files/${encodedKey}`;
  }

  async read(storageKey: string): Promise<Buffer> {
    assertValidStorageKey(storageKey);
    const data = await this.objects.get(storageKey);
    if (!data) {
      const error = new Error('Imagen no encontrada') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    return data;
  }
}

export function createR2MediaStorage(env: NodeJS.ProcessEnv = process.env): R2MediaStorage {
  const config = r2ConfigFromEnv(env);
  return new R2MediaStorage(config, createS3R2ObjectClient(config));
}

function contentTypeFor(storageKey: string): string {
  const extension = storageKey.slice(storageKey.lastIndexOf('.') + 1);
  return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}

function isMissingObject(error: unknown): boolean {
  if (error instanceof NoSuchKey) return true;
  const named = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return named.name === 'NotFound' || named.name === 'NoSuchKey' || named.$metadata?.httpStatusCode === 404;
}
