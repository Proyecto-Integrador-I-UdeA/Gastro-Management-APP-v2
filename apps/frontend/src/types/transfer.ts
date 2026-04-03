/** Respuesta paginada de GET /inventory-movements */
export type InventoryMovementsListResponse = {
  items: InventoryMovementRow[];
  total: number;
};

export type WarehouseSummary = {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
};

export type MovementProductSummary = {
  id: number;
  internalCode: string;
  name: string;
  unitOfMeasure: string;
  inputUnit?: string;
  inputUnitQuantity?: number;
};

export type MovementUserSummary = {
  id: number;
  email: string;
  fullName: string | null;
};

export type InventoryMovementRow = {
  id: number;
  type: string;
  quantity: number;
  /** Costo de la línea (compras); Prisma Decimal como string en JSON */
  unitCost?: string | number | null;
  expirationDate: string | null;
  notes: string | null;
  productId: number;
  sourceWarehouseId: number | null;
  destinationWarehouseId: number | null;
  userId: number;
  createdAt: string;
  updatedAt?: string;
  product?: MovementProductSummary;
  sourceWarehouse?: WarehouseSummary | null;
  destinationWarehouse?: WarehouseSummary | null;
  user?: MovementUserSummary;
};

export type CreateTransferPayload = {
  type: 'TRANSFER';
  productId: number;
  quantity: number;
  sourceWarehouseId: number;
  destinationWarehouseId: number;
  notes?: string | null;
  expirationDate?: string | null;
};

/** Entrada por compra: costo unitario queda en el movimiento */
export type CreatePurchasePayload = {
  type: 'PURCHASE';
  productId: number;
  quantity: number;
  unitCost: number;
  destinationWarehouseId: number;
  notes?: string | null;
  expirationDate?: string | null;
};

export type CreateTransferModulePayload = CreateTransferPayload | CreatePurchasePayload;
