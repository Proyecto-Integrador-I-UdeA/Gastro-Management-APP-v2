import { MovementType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  applyInventoryMovement,
  KardexError,
} from '../../src/services/inventoryMovementService';

function transaction(stock: number | null) {
  return {
    inventory: {
      findUnique: vi.fn().mockResolvedValue(stock === null ? null : { quantity: stock }),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    inventoryMovement: {
      create: vi.fn().mockResolvedValue({ id: 10 }),
    },
  };
}

describe('salida de inventario', () => {
  it('mantiene el bloqueo de saldo negativo para consumos manuales', async () => {
    const tx = transaction(5);
    await expect(applyInventoryMovement(
      tx as never,
      MovementType.CONSUMPTION,
      { productId: 1, quantity: 6, sourceWarehouseId: 2 },
      3,
    )).rejects.toBeInstanceOf(KardexError);
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('permite y conserva saldo negativo para consumo físico confirmado por Cocina', async () => {
    const tx = transaction(5);
    await applyInventoryMovement(
      tx as never,
      MovementType.CONSUMPTION,
      {
        productId: 1,
        quantity: 6,
        sourceWarehouseId: 2,
        allowNegativeStock: true,
      },
      3,
    );
    expect(tx.inventory.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ quantity: -6 }),
      update: { quantity: { decrement: 6 } },
    }));
  });

  it('aplica un ajuste físico firmado y fija exactamente el saldo contado', async () => {
    const tx = transaction(10);
    await applyInventoryMovement(
      tx as never,
      MovementType.ADJUSTMENT,
      { productId: 1, quantity: -2, sourceWarehouseId: 2, adjustmentTargetQuantity: 8, notes: 'Conteo físico #1' },
      3,
    );
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'ADJUSTMENT', quantity: -2, sourceWarehouseId: 2, destinationWarehouseId: null }) });
    expect(tx.inventory.update).toHaveBeenCalledWith({ where: { productId_warehouseId: { productId: 1, warehouseId: 2 } }, data: { quantity: 8 } });
  });
});
