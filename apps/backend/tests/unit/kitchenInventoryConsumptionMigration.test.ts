import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(
  process.cwd(),
  'prisma/migrations/20260910120000_kitchen_01d_ready_inventory_consumption/migration.sql',
), 'utf8');

describe('migración KITCHEN-01D', () => {
  it('respalda singleton, rango, snapshots e idempotencia en PostgreSQL', () => {
    expect(sql).toContain('"global_waste_config_singleton_check"');
    expect(sql).toContain('"global_waste_config_percent_check"');
    expect(sql).toContain('"kitchen_inventory_consumptions_kitchenDispatchId_key"');
    expect(sql).toContain('"wastePercentSnapshot" DECIMAL(5,2) NOT NULL');
    expect(sql).toContain('"theoreticalQuantity" DECIMAL(18,6) NOT NULL');
    expect(sql).toContain('"adjustedQuantity" DECIMAL(18,6) NOT NULL');
    expect(sql).toContain('"inventoryMovementId" INTEGER NOT NULL');
    expect(sql).toContain('VALUES (1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)');
  });
});
