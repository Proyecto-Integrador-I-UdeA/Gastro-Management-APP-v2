/** Respuesta paginada de GET /inventory-movements */
export type InventoryMovementsListResponse = {
  items: InventoryMovementRow[];
  total: number;
};

export type WarehouseSummary = {
  id: number;
  name: string;
  description: string | null;
  /** Solo una debería ser true; entradas por compra usan esta bodega */
  isMain?: boolean;
  active: boolean;
};

export type MovementProductSummary = {
  id: number;
  internalCode: string;
  name: string;
  unitOfMeasure: string;
  inputUnit?: string;
  inputUnitQuantity?: number;
  /** Incluido cuando el API hace include del proveedor del producto */
  supplier?: { id: number; name: string } | null;
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
  /** Siempre null: el backend exige sin bodega de origen en compras */
  sourceWarehouseId?: null;
  destinationWarehouseId: number;
  notes?: string | null;
  expirationDate?: string | null;
};

export type CreateTransferModulePayload = CreateTransferPayload | CreatePurchasePayload;
