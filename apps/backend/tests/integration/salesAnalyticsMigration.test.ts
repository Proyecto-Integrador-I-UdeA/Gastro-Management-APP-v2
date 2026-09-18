import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createIntegrationToken } from './authToken';

let app: Express;

const migrationSql = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/20260918120000_sales_01a_category_snapshots/migration.sql'),
  'utf8',
);

describe('SALES-01A category snapshot migration', () => {
  beforeAll(async () => {
    app = (await import('../../src/app')).default;
  });

  it('adds nullable historical category snapshots and backfills from the current MenuItem relation', () => {
    expect(migrationSql).toContain('ADD COLUMN "menuCategoryIdSnapshot" INTEGER');
    expect(migrationSql).toContain('ADD COLUMN "menuCategoryNameSnapshot" TEXT');
    expect(migrationSql).toContain('UPDATE "sales_order_items" AS soi');
    expect(migrationSql).toContain('FROM "MenuItem" AS mi');
    expect(migrationSql).toContain('LEFT JOIN "menu_categories" AS mc');
    expect(migrationSql).toContain('sales_order_items_menuCategoryIdSnapshot_idx');
    expect(migrationSql).not.toMatch(/^\s*(?:DROP|DELETE)\b/im);
  });

  it('protege el endpoint con reports.read y no concede acceso solo con sales.read', async () => {
    expect((await request(app).get('/sales/analytics')).status).toBe(401);
    expect((await request(app).get('/sales/analytics').set('Authorization', `Bearer ${createIntegrationToken(['sales.read'])}`)).status).toBe(403);
    expect((await request(app).get('/sales/analytics?period=invalid').set('Authorization', `Bearer ${createIntegrationToken(['reports.read'])}`)).status).toBe(400);
    expect((await request(app).get('/sales/analytics?period=day&date=2025-02-31').set('Authorization', `Bearer ${createIntegrationToken(['reports.read'])}`)).status).toBe(400);
  });
});
