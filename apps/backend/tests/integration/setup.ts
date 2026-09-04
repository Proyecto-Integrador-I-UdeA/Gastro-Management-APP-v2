import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { configureIntegrationTestDatabase } from './testDatabase';

const envResult = dotenv.config({
  path: resolve(process.cwd(), '.env.test'),
  override: true,
});

if (envResult.error && !process.env.TEST_DATABASE_URL) {
  throw new Error('No fue posible cargar TEST_DATABASE_URL desde .env.test.');
}

configureIntegrationTestDatabase();
