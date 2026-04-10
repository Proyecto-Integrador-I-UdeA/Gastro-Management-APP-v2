/** Fila de GET /inventories (Prisma Inventory + product + warehouse) */
export type InventoryListRow = {
  id: number;
  quantity: number;
  productId: number;
  warehouseId: number;
  product: {
    id: number;
    internalCode: string;
    name: string;
    unitOfMeasure: string;
    minStock: number;
    maxStock: number;
    active?: boolean;
    supplier?: { id: number; name: string } | null;
  };
  warehouse: {
    id: number;
    name: string;
    active: boolean;
  };
};
