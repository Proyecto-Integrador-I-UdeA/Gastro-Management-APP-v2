import { describe, expect, it } from 'vitest';
import {
  addOrderItemSchema,
  openTableOrderSchema,
  updateOrderGuestCountSchema,
  updateOrderItemSchema,
} from '../../src/schemas/salesOrderSchema';

describe('contratos de escritura de mesas y pedidos', () => {
  it('acepta cantidades positivas y normaliza indicaciones', () => {
    expect(addOrderItemSchema.parse({
      menuItemId: 10,
      quantity: 2,
      specialInstructions: '  Sin cebolla  ',
      additions: [{ menuItemId: 20 }],
    })).toEqual({
      menuItemId: 10,
      quantity: 2,
      specialInstructions: 'Sin cebolla',
      additions: [{ menuItemId: 20 }],
    });
    expect(updateOrderItemSchema.parse({ specialInstructions: '   ' })).toEqual({
      specialInstructions: null,
    });
  });

  it('rechaza cantidades inválidas e indicaciones de más de 500 caracteres', () => {
    expect(addOrderItemSchema.safeParse({ menuItemId: 1, quantity: 0 }).success).toBe(false);
    expect(addOrderItemSchema.safeParse({ menuItemId: 1, quantity: -1 }).success).toBe(false);
    expect(addOrderItemSchema.safeParse({
      menuItemId: 1,
      quantity: 1,
      specialInstructions: 'x'.repeat(501),
    }).success).toBe(false);
    expect(updateOrderItemSchema.safeParse({}).success).toBe(false);
  });

  it('mantiene contratos estrictos contra campos internos inyectados', () => {
    for (const payload of [
      { guestCount: 2, openedById: 99 },
      { menuItemId: 1, quantity: 1, price: '0.01' },
      { menuItemId: 1, quantity: 1, currency: 'USD' },
      { menuItemId: 1, quantity: 1, parentItemId: 5 },
      { menuItemId: 1, quantity: 1, addedById: 99 },
      { menuItemId: 1, quantity: 1, status: 'SETTLED' },
    ]) {
      const schema = 'guestCount' in payload ? openTableOrderSchema : addOrderItemSchema;
      expect(schema.safeParse(payload).success).toBe(false);
    }
  });

  it('acepta guestCount opcional/null según la operación y rechaza cero', () => {
    expect(openTableOrderSchema.parse({})).toEqual({});
    expect(openTableOrderSchema.parse({ guestCount: 3 })).toEqual({ guestCount: 3 });
    expect(updateOrderGuestCountSchema.parse({ guestCount: null })).toEqual({
      guestCount: null,
    });
    expect(updateOrderGuestCountSchema.safeParse({ guestCount: 0 }).success).toBe(false);
  });
});
