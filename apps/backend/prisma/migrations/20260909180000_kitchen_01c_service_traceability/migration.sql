-- Add lifecycle actor and delivery traceability to KitchenDispatch.
ALTER TABLE "kitchen_dispatches"
ADD COLUMN "startedById" INTEGER,
ADD COLUMN "readyById" INTEGER,
ADD COLUMN "deliveredAt" TIMESTAMP(3),
ADD COLUMN "deliveredById" INTEGER;

-- Reuse SalesOrder.status = VOIDED and its existing voidedAt timestamp as the
-- authoritative order-cancellation state/time. Add only the missing trace data.
ALTER TABLE "sales_orders"
ADD COLUMN "cancelledById" INTEGER,
ADD COLUMN "cancellationReason" VARCHAR(500),
ADD COLUMN "cancellationAcknowledgedAt" TIMESTAMP(3),
ADD COLUMN "cancellationAcknowledgedById" INTEGER;

ALTER TABLE "kitchen_dispatches"
ADD CONSTRAINT "kitchen_dispatches_delivery_pair_check" CHECK (
    ("deliveredAt" IS NULL AND "deliveredById" IS NULL)
    OR ("deliveredAt" IS NOT NULL AND "deliveredById" IS NOT NULL)
),
ADD CONSTRAINT "kitchen_dispatches_started_actor_check" CHECK (
    "startedById" IS NULL OR "startedAt" IS NOT NULL
),
ADD CONSTRAINT "kitchen_dispatches_ready_actor_check" CHECK (
    "readyById" IS NULL OR "readyAt" IS NOT NULL
),
ADD CONSTRAINT "kitchen_dispatches_delivery_status_check" CHECK (
    "deliveredAt" IS NULL OR "status" = 'READY'
);

ALTER TABLE "sales_orders"
ADD CONSTRAINT "sales_orders_cancellation_reason_check" CHECK (
    "cancellationReason" IS NULL OR LENGTH(BTRIM("cancellationReason")) > 0
),
ADD CONSTRAINT "sales_orders_cancellation_ack_pair_check" CHECK (
    ("cancellationAcknowledgedAt" IS NULL AND "cancellationAcknowledgedById" IS NULL)
    OR (
        "cancellationAcknowledgedAt" IS NOT NULL
        AND "cancellationAcknowledgedById" IS NOT NULL
    )
),
ADD CONSTRAINT "sales_orders_cancellation_trace_status_check" CHECK (
    (
        "status" <> 'VOIDED'
        AND "cancelledById" IS NULL
        AND "cancellationReason" IS NULL
        AND "cancellationAcknowledgedAt" IS NULL
        AND "cancellationAcknowledgedById" IS NULL
    )
    OR "status" = 'VOIDED'
),
ADD CONSTRAINT "sales_orders_cancellation_required_check" CHECK (
    "status" <> 'VOIDED'
    OR (
        "cancelledById" IS NULL
        AND "cancellationReason" IS NULL
        AND "cancellationAcknowledgedAt" IS NULL
        AND "cancellationAcknowledgedById" IS NULL
    )
    OR (
        "cancelledById" IS NOT NULL
        AND "cancellationReason" IS NOT NULL
        AND LENGTH(BTRIM("cancellationReason")) > 0
    )
);

CREATE INDEX "kitchen_dispatches_dispatchedById_status_deliveredAt_idx"
ON "kitchen_dispatches"("dispatchedById", "status", "deliveredAt");

CREATE INDEX "kitchen_dispatches_deliveredAt_idx"
ON "kitchen_dispatches"("deliveredAt");

CREATE INDEX "sales_orders_status_cancellationAcknowledgedAt_idx"
ON "sales_orders"("status", "cancellationAcknowledgedAt");

ALTER TABLE "kitchen_dispatches"
ADD CONSTRAINT "kitchen_dispatches_startedById_fkey"
FOREIGN KEY ("startedById") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kitchen_dispatches"
ADD CONSTRAINT "kitchen_dispatches_readyById_fkey"
FOREIGN KEY ("readyById") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "kitchen_dispatches"
ADD CONSTRAINT "kitchen_dispatches_deliveredById_fkey"
FOREIGN KEY ("deliveredById") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_orders"
ADD CONSTRAINT "sales_orders_cancelledById_fkey"
FOREIGN KEY ("cancelledById") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sales_orders"
ADD CONSTRAINT "sales_orders_cancellationAcknowledgedById_fkey"
FOREIGN KEY ("cancellationAcknowledgedById") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
