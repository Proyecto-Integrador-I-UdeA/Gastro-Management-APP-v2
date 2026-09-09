export type KitchenDispatchStatus = "NEXT" | "PREPARING" | "READY";

export type KitchenDispatchAddition = {
  id: number;
  salesOrderItemId: number;
  name: string;
  quantity: number;
  specialInstructions: string | null;
};

export type KitchenDispatchItem = KitchenDispatchAddition & {
  additions: KitchenDispatchAddition[];
};

export type KitchenDispatch = {
  id: number;
  dispatchNumber: number;
  orderId: number;
  orderNumber: number;
  orderOpenedAt: string;
  table: {
    id: number;
    code: string;
    area: string | null;
  };
  status: KitchenDispatchStatus;
  dispatchedBy: {
    id: number;
    fullName: string | null;
  };
  dispatchedAt: string;
  prepTimeMinutesSnapshot: number;
  warningThresholdMinutes: number;
  targetReadyAt: string;
  startedAt: string | null;
  readyAt: string | null;
  items: KitchenDispatchItem[];
};

export type KitchenQueueResponse = {
  dispatches: KitchenDispatch[];
};

export type KitchenStatusUpdateInput = {
  status: KitchenDispatchStatus;
};

export type KitchenOrderSummary = {
  hasPendingKitchenItems: boolean;
  pendingKitchenItemCount: number;
  kitchenDispatchCount: number;
  latestKitchenStatus: KitchenDispatchStatus | null;
  latestKitchenDispatchedAt: string | null;
};

export type KitchenOrderLineState = {
  kitchenDispatched: boolean;
  kitchenDispatchId: number | null;
  kitchenStatus: KitchenDispatchStatus | null;
  kitchenDispatchedAt: string | null;
};
