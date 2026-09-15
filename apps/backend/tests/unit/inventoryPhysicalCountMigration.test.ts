import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(process.cwd(), 'prisma/migrations/20260915120000_inventory_01a_physical_counts/migration.sql'), 'utf8');
describe('migración INVENTORY-01A', () => {
  it('es aditiva y define estados, snapshots, unicidad y trazabilidad', () => {
    expect(sql).toContain(`ALTER TYPE "MovementType" ADD VALUE 'ADJUSTMENT'`);
    expect(sql).toContain(`CREATE TYPE "InventoryPhysicalCountStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED')`);
    expect(sql).toContain('"systemQuantitySnapshot" DOUBLE PRECISION NOT NULL');
    expect(sql).toContain('"unitCostSnapshot" DECIMAL(24,12) NOT NULL');
    expect(sql).toContain('"estimatedValueVariance" DECIMAL(30,12)');
    expect(sql).toContain('physicalCountId_productId_key');
    expect(sql).toContain('physical_counts_lifecycle_check');
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
  });
});
