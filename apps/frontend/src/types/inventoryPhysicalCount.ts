export type PhysicalCountStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type PhysicalCountReason = 'PHYSICAL_COUNT' | 'UNRECORDED_ENTRY' | 'WASTE_OR_YIELD_VARIANCE' | 'DAMAGE_OR_LOSS' | 'DATA_CORRECTION' | 'OTHER';

export type PhysicalCountItem = {
  id: number;
  productId: number;
  systemQuantitySnapshot: number;
  countedQuantity: number | null;
  varianceQuantity: number | null;
  unit: 'g' | 'ml' | 'und';
  unitCostSnapshot: string;
  estimatedValueVariance: string | null;
  inventoryMovementId: number | null;
  product: { id: number; internalCode: string; name: string; unitOfMeasure: string };
  inventoryMovement: { id: number; quantity: number; createdAt: string } | null;
};

export type PhysicalCount = {
  id: number;
  warehouseId: number;
  status: PhysicalCountStatus;
  reason: PhysicalCountReason;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  postedAt: string | null;
  cancelledAt: string | null;
  warehouse: { id: number; name: string; active: boolean; isMain: boolean };
  createdBy: { id: number; fullName: string | null; email: string };
  updatedBy: { id: number; fullName: string | null; email: string };
  postedBy: { id: number; fullName: string | null; email: string } | null;
  cancelledBy: { id: number; fullName: string | null; email: string } | null;
  items: PhysicalCountItem[];
};

export type CountReferences = {
  warehouses: Array<{ id: number; name: string; active: boolean; isMain: boolean }>;
  products: Array<{ id: number; internalCode: string; name: string; unitOfMeasure: string; systemQuantity: number; unitCostEstimate: string | null }>;
};
