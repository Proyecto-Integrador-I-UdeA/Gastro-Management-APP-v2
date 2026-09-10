export type KitchenDispatchStatus = "NEXT" | "PREPARING" | "READY";
export type KitchenServiceStatus = KitchenDispatchStatus | "DELIVERED";

export type LifecycleActor = {
  id: number;
  fullName: string | null;
};

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
  startedBy: { id: number; fullName: string | null } | null;
  readyAt: string | null;
  readyBy: { id: number; fullName: string | null } | null;
  deliveredAt: string | null;
  deliveredBy: { id: number; fullName: string | null } | null;
  items: KitchenDispatchItem[];
};

export type KitchenCancellationAlert = {
  orderId: number;
  orderNumber: number;
  table: {
    id: number;
    code: string;
    area: string | null;
  };
  cancelledAt: string;
  cancelledBy: { id: number; fullName: string | null } | null;
  cancellationReason: string;
  cancellationAcknowledgedAt: string | null;
  cancellationAcknowledgedBy: { id: number; fullName: string | null } | null;
  affectedDispatches: Array<{
    id: number;
    status: KitchenDispatchStatus;
  }>;
};

export type KitchenQueueResponse = {
  dispatches: KitchenDispatch[];
  cancellations: KitchenCancellationAlert[];
};

export type ReadyKitchenPickup = {
  dispatchId: number;
  salesOrderId: number;
  orderNumber: number;
  table: {
    id: number;
    code: string;
    area: string | null;
  };
  status: "READY";
  readyAt: string;
  deliveredAt: null;
  cancelled: false;
};

export type ReadyKitchenPickupsResponse = {
  pickups: ReadyKitchenPickup[];
};

export type SalesKitchenDispatchTrace = {
  id: number;
  dispatchNumber: number;
  status: KitchenDispatchStatus;
  dispatchedAt: string;
  dispatchedBy: LifecycleActor;
  startedAt: string | null;
  startedBy: LifecycleActor | null;
  readyAt: string | null;
  readyBy: LifecycleActor | null;
  deliveredAt: string | null;
  deliveredBy: LifecycleActor | null;
};

export type KitchenStatusUpdateInput = {
  status: KitchenDispatchStatus;
};

export type KitchenOrderSummary = {
  hasPendingKitchenItems: boolean;
  pendingKitchenItemCount: number;
  kitchenDispatchCount: number;
  latestKitchenStatus: KitchenDispatchStatus | null;
  kitchenServiceStatus: KitchenServiceStatus | null;
  latestKitchenDispatchedAt: string | null;
};

export type KitchenOrderLineState = {
  kitchenDispatched: boolean;
  kitchenDispatchId: number | null;
  kitchenStatus: KitchenDispatchStatus | null;
  kitchenDispatchedAt: string | null;
  kitchenDeliveredAt: string | null;
};
