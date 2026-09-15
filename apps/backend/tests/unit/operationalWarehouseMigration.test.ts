import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(
  process.cwd(),
  'prisma/migrations/20260915170000_operational_warehouse_routing/migration.sql',
), 'utf8');

describe('migración de usos operativos de bodegas', () => {
  it('agrega los tres usos y protege la unicidad de cada uso activo', () => {
    expect(sql).toContain('"purchaseReceiving" BOOLEAN NOT NULL DEFAULT false');
    expect(sql).toContain('"kitchenConsumption" BOOLEAN NOT NULL DEFAULT false');
    expect(sql).toContain('"barConsumption" BOOLEAN NOT NULL DEFAULT false');
    expect(sql).toContain('"warehouses_one_active_purchase_receiving_idx"');
    expect(sql).toContain('"warehouses_one_active_kitchen_consumption_idx"');
    expect(sql).toContain('"warehouses_one_active_bar_consumption_idx"');
    expect(sql).toContain('WHERE "active" = true AND "kitchenConsumption" = true');
  });

  it('migra solo recepción de compras cuando existe una única principal activa', () => {
    expect(sql).toContain('SET "purchaseReceiving" = true');
    expect(sql).toContain('WHERE "active" = true AND "isMain" = true');
    expect(sql).toContain('HAVING COUNT(*) = 1');
    expect(sql).not.toMatch(/SET\s+"kitchenConsumption"\s*=\s*true/i);
    expect(sql).not.toMatch(/SET\s+"barConsumption"\s*=\s*true/i);
  });
});
