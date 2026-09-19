-- RESERVATIONS-01A: internal reservations and events management.

CREATE TYPE "ReservationType" AS ENUM (
    'TABLE_RESERVATION',
    'PRIVATE_EVENT',
    'CORPORATE_EVENT',
    'OTHER'
);

CREATE TYPE "ReservationStatus" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'CANCELLED',
    'COMPLETED'
);

CREATE TYPE "ReservationHistoryAction" AS ENUM (
    'CREATED',
    'UPDATED',
    'CONFIRMED',
    'RESCHEDULED',
    'CANCELLED',
    'COMPLETED'
);

CREATE TABLE "reservations" (
    "id" SERIAL NOT NULL,
    "customerName" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(50) NOT NULL,
    "email" VARCHAR(320),
    "reservationType" "ReservationType" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "guestCount" INTEGER NOT NULL,
    "preferredArea" VARCHAR(120),
    "diningTableId" INTEGER,
    "reason" VARCHAR(500) NOT NULL,
    "notes" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "createdById" INTEGER NOT NULL,
    "updatedById" INTEGER NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" INTEGER,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" INTEGER,
    "cancellationReason" VARCHAR(500),
    "lateCancellation" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reservations_guest_count_check" CHECK ("guestCount" > 0),
    CONSTRAINT "reservations_status_trace_check" CHECK (
        ("status" = 'PENDING'
            AND "confirmedAt" IS NULL AND "confirmedById" IS NULL
            AND "cancelledAt" IS NULL AND "cancelledById" IS NULL AND "cancellationReason" IS NULL
            AND "completedAt" IS NULL AND "completedById" IS NULL
            AND "lateCancellation" = false)
        OR
        ("status" = 'CONFIRMED'
            AND "confirmedAt" IS NOT NULL AND "confirmedById" IS NOT NULL
            AND "cancelledAt" IS NULL AND "cancelledById" IS NULL AND "cancellationReason" IS NULL
            AND "completedAt" IS NULL AND "completedById" IS NULL
            AND "lateCancellation" = false)
       OR
("status" = 'CANCELLED'
    AND "cancelledAt" IS NOT NULL
    AND "cancelledById" IS NOT NULL
    AND "cancellationReason" IS NOT NULL
    AND "completedAt" IS NULL
    AND "completedById" IS NULL
    AND (
        ("confirmedAt" IS NULL
            AND "confirmedById" IS NULL
            AND "lateCancellation" = false)
        OR
        ("confirmedAt" IS NOT NULL
            AND "confirmedById" IS NOT NULL)
    ))
       
       
        OR
        ("status" = 'COMPLETED'
            AND "confirmedAt" IS NOT NULL AND "confirmedById" IS NOT NULL
            AND "completedAt" IS NOT NULL AND "completedById" IS NOT NULL
            AND "cancelledAt" IS NULL AND "cancelledById" IS NULL AND "cancellationReason" IS NULL
            AND "lateCancellation" = false)
    )
);

CREATE TABLE "reservation_history" (
    "id" SERIAL NOT NULL,
    "reservationId" INTEGER NOT NULL,
    "action" "ReservationHistoryAction" NOT NULL,
    "actorId" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" VARCHAR(500),
    "previousScheduledAt" TIMESTAMP(3),
    "newScheduledAt" TIMESTAMP(3),
    "previousStatus" "ReservationStatus",
    "newStatus" "ReservationStatus",

    CONSTRAINT "reservation_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reservations_scheduledAt_idx" ON "reservations"("scheduledAt");
CREATE INDEX "reservations_status_scheduledAt_idx" ON "reservations"("status", "scheduledAt");
CREATE INDEX "reservations_diningTableId_idx" ON "reservations"("diningTableId");
CREATE INDEX "reservations_reservationType_scheduledAt_idx" ON "reservations"("reservationType", "scheduledAt");
CREATE INDEX "reservation_history_reservationId_occurredAt_id_idx" ON "reservation_history"("reservationId", "occurredAt", "id");

ALTER TABLE "reservations" ADD CONSTRAINT "reservations_diningTableId_fkey"
    FOREIGN KEY ("diningTableId") REFERENCES "dining_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_confirmedById_fkey"
    FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_cancelledById_fkey"
    FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_completedById_fkey"
    FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_history" ADD CONSTRAINT "reservation_history_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_history" ADD CONSTRAINT "reservation_history_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("name", "description", "createdAt", "updatedAt")
VALUES
    ('reservations.read', 'Consultar reservas y eventos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('reservations.manage', 'Administrar reservas y eventos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId", "createdAt", "updatedAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "roles" AS r
CROSS JOIN "permissions" AS p
WHERE r."name" IN ('admin', 'super')
  AND p."name" IN ('reservations.read', 'reservations.manage')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
