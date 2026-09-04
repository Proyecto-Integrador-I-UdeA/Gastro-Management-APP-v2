const ALLOWED_LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);
const TEST_DATABASE_NAME = 'gastro_management_test';

export function configureIntegrationTestDatabase(): string {
  const rawUrl = process.env.TEST_DATABASE_URL;
  if (!rawUrl) {
    throw new Error(
      'TEST_DATABASE_URL es obligatoria para ejecutar pruebas de integración.',
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error('TEST_DATABASE_URL no es una URL válida.');
  }

  if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
    throw new Error('TEST_DATABASE_URL debe usar el protocolo PostgreSQL.');
  }

  if (!ALLOWED_LOCAL_HOSTS.has(parsedUrl.hostname.toLowerCase())) {
    throw new Error(
      'TEST_DATABASE_URL debe apuntar exclusivamente a 127.0.0.1 o localhost.',
    );
  }

  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ''));
  if (databaseName !== TEST_DATABASE_NAME) {
    throw new Error(
      `TEST_DATABASE_URL debe usar exclusivamente la base ${TEST_DATABASE_NAME}.`,
    );
  }

  process.env.DATABASE_URL = rawUrl;
  return rawUrl;
}
