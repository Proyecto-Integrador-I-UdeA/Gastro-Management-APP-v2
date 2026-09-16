-- CASH-01A: voluntary service, cash sessions, prefactures and payments.
CREATE TYPE "SalesPaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');
CREATE TYPE "SalesPreInvoiceStatus" AS ENUM ('ACTIVE', 'REPLACED');
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "CashPaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'OTHER');

ALTER TABLE "sales_orders"
  ADD COLUMN "paymentStatus" "SalesPaymentStatus" NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN "accountRequestedAt" TIMESTAMP(3),
  ADD COLUMN "accountRequestedById" INTEGER,
  ADD COLUMN "suggestedServicePercentSnapshot" DECIMAL(5,2);

ALTER TABLE "sales_order_items"
  ADD COLUMN "unitConsumptionTaxAmountSnapshot" DECIMAL(12,2),
  ADD COLUMN "unitSalesAmountSnapshot" DECIMAL(12,2);

UPDATE "sales_order_items" soi
SET "unitConsumptionTaxAmountSnapshot" = CASE WHEN soi."taxIncludedSnapshot" THEN LEAST(soi."unitPriceSnapshot", ROUND(mip."taxAmount", 2)) ELSE 0 END,
    "unitSalesAmountSnapshot" = soi."unitPriceSnapshot" - CASE WHEN soi."taxIncludedSnapshot" THEN LEAST(soi."unitPriceSnapshot", ROUND(mip."taxAmount", 2)) ELSE 0 END
FROM "menu_item_prices" mip
WHERE mip."id" = soi."menuItemPriceId";

ALTER TABLE "sales_order_items"
  ALTER COLUMN "unitConsumptionTaxAmountSnapshot" SET NOT NULL,
  ALTER COLUMN "unitSalesAmountSnapshot" SET NOT NULL,
  ADD CONSTRAINT "sales_order_items_financial_snapshot_check" CHECK (
    "unitSalesAmountSnapshot" >= 0 AND "unitConsumptionTaxAmountSnapshot" >= 0
    AND "unitPriceSnapshot" = "unitSalesAmountSnapshot" + "unitConsumptionTaxAmountSnapshot"
  );

ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_account_snapshot_check" CHECK (
  ("accountRequestedAt" IS NULL AND "accountRequestedById" IS NULL AND "suggestedServicePercentSnapshot" IS NULL)
  OR ("accountRequestedAt" IS NOT NULL AND "accountRequestedById" IS NOT NULL AND "suggestedServicePercentSnapshot" IS NOT NULL AND "suggestedServicePercentSnapshot" BETWEEN 0 AND 100)
);

CREATE TABLE "sales_pre_invoices" (
  "id" SERIAL NOT NULL,
  "salesOrderId" INTEGER NOT NULL,
  "subtotalSnapshot" DECIMAL(14,2) NOT NULL,
  "salesAmountSnapshot" DECIMAL(14,2) NOT NULL,
  "consumptionTaxAmountSnapshot" DECIMAL(14,2) NOT NULL,
  "suggestedServicePercentSnapshot" DECIMAL(5,2) NOT NULL,
  "serviceAccepted" BOOLEAN NOT NULL,
  "servicePercentSnapshot" DECIMAL(5,2) NOT NULL,
  "serviceAmountSnapshot" DECIMAL(14,2) NOT NULL,
  "totalSnapshot" DECIMAL(14,2) NOT NULL,
  "status" "SalesPreInvoiceStatus" NOT NULL DEFAULT 'ACTIVE',
  "generatedById" INTEGER NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "replacedAt" TIMESTAMP(3),
  CONSTRAINT "sales_pre_invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_pre_invoices_percent_check" CHECK (
    "suggestedServicePercentSnapshot" >= 0 AND "suggestedServicePercentSnapshot" <= 100
    AND "servicePercentSnapshot" >= 0 AND "servicePercentSnapshot" <= 100
  ),
  CONSTRAINT "sales_pre_invoices_amounts_check" CHECK (
    "subtotalSnapshot" >= 0 AND "salesAmountSnapshot" >= 0 AND "consumptionTaxAmountSnapshot" >= 0
    AND "subtotalSnapshot" = "salesAmountSnapshot" + "consumptionTaxAmountSnapshot"
    AND "serviceAmountSnapshot" >= 0 AND "totalSnapshot" = "subtotalSnapshot" + "serviceAmountSnapshot"
  ),
  CONSTRAINT "sales_pre_invoices_service_check" CHECK (
    (NOT "serviceAccepted" AND "servicePercentSnapshot" = 0 AND "serviceAmountSnapshot" = 0)
    OR ("serviceAccepted" AND "servicePercentSnapshot" = "suggestedServicePercentSnapshot"
   AND "serviceAmountSnapshot" = ROUND("subtotalSnapshot" * "servicePercentSnapshot" / 100, 2))
  )
);

CREATE TABLE "cash_registers" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cash_sessions" (
  "id" SERIAL NOT NULL,
  "cashRegisterId" INTEGER NOT NULL,
  "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
  "openedById" INTEGER NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "openingCash" DECIMAL(14,2) NOT NULL,
  "closedById" INTEGER,
  "closedAt" TIMESTAMP(3),
  "expectedCash" DECIMAL(14,2),
  "countedCash" DECIMAL(14,2),
  "difference" DECIMAL(14,2),
  CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cash_sessions_opening_cash_check" CHECK ("openingCash" >= 0 AND ("countedCash" IS NULL OR "countedCash" >= 0)),
  CONSTRAINT "cash_sessions_close_pair_check" CHECK (
    ("status" = 'OPEN' AND "closedAt" IS NULL AND "closedById" IS NULL AND "expectedCash" IS NULL AND "countedCash" IS NULL AND "difference" IS NULL)
    OR ("status" = 'CLOSED' AND "closedAt" IS NOT NULL AND "closedById" IS NOT NULL AND "expectedCash" IS NOT NULL AND "countedCash" IS NOT NULL AND "difference" IS NOT NULL AND "difference" = "countedCash" - "expectedCash")
  )
);

CREATE TABLE "cash_payments" (
  "id" SERIAL NOT NULL,
  "preInvoiceId" INTEGER NOT NULL,
  "cashSessionId" INTEGER NOT NULL,
  "method" "CashPaymentMethod" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "salesAmount" DECIMAL(14,2) NOT NULL,
  "consumptionTaxAmount" DECIMAL(14,2) NOT NULL,
  "serviceAmount" DECIMAL(14,2) NOT NULL,
  "amountTendered" DECIMAL(14,2),
  "change" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "receivedById" INTEGER NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cash_payments_amount_check" CHECK ("amount" > 0 AND "change" >= 0 AND ("amountTendered" IS NULL OR "amountTendered" >= "amount")),
  CONSTRAINT "cash_payments_split_check" CHECK ("salesAmount" >= 0 AND "consumptionTaxAmount" >= 0 AND "serviceAmount" >= 0 AND "amount" = "salesAmount" + "consumptionTaxAmount" + "serviceAmount"),
  CONSTRAINT "cash_payments_cash_change_check" CHECK (
    ("method" = 'CASH' AND "amountTendered" IS NOT NULL AND "change" = "amountTendered" - "amount")
    OR ("method" <> 'CASH' AND "amountTendered" IS NULL AND "change" = 0)
  )
);

CREATE TABLE "cash_service_config" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "servicePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "updatedById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_service_config_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cash_service_config_singleton_check" CHECK ("id" = 1),
  CONSTRAINT "cash_service_config_percent_check" CHECK ("servicePercent" >= 0 AND "servicePercent" <= 100)
);

CREATE TABLE "cash_service_config_audits" (
  "id" SERIAL NOT NULL,
  "configId" INTEGER NOT NULL,
  "previousPercent" DECIMAL(5,2) NOT NULL,
  "newPercent" DECIMAL(5,2) NOT NULL,
  "changedById" INTEGER NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_service_config_audits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cash_service_config_audits_percent_check" CHECK ("previousPercent" >= 0 AND "previousPercent" <= 100 AND "newPercent" >= 0 AND "newPercent" <= 100)
);

CREATE UNIQUE INDEX "sales_pre_invoices_one_active_per_order_idx"
  ON "sales_pre_invoices"("salesOrderId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "cash_registers_name_key" ON "cash_registers"("name");
CREATE UNIQUE INDEX "cash_sessions_one_open_per_register_idx"
  ON "cash_sessions"("cashRegisterId") WHERE "status" = 'OPEN';
CREATE UNIQUE INDEX "cash_payments_idempotencyKey_key" ON "cash_payments"("idempotencyKey");
CREATE INDEX "sales_pre_invoices_order_status_idx" ON "sales_pre_invoices"("salesOrderId", "status");
CREATE INDEX "cash_sessions_register_status_idx" ON "cash_sessions"("cashRegisterId", "status");
CREATE INDEX "cash_payments_invoice_receivedAt_idx" ON "cash_payments"("preInvoiceId", "receivedAt");
CREATE INDEX "cash_payments_session_method_receivedAt_idx" ON "cash_payments"("cashSessionId", "method", "receivedAt");
CREATE INDEX "cash_service_config_audits_config_changedAt_idx" ON "cash_service_config_audits"("configId", "changedAt");

ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_accountRequestedById_fkey"
  FOREIGN KEY ("accountRequestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_pre_invoices" ADD CONSTRAINT "sales_pre_invoices_salesOrderId_fkey"
  FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_pre_invoices" ADD CONSTRAINT "sales_pre_invoices_generatedById_fkey"
  FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_cashRegisterId_fkey"
  FOREIGN KEY ("cashRegisterId") REFERENCES "cash_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_openedById_fkey"
  FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_closedById_fkey"
  FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_payments" ADD CONSTRAINT "cash_payments_preInvoiceId_fkey"
  FOREIGN KEY ("preInvoiceId") REFERENCES "sales_pre_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_payments" ADD CONSTRAINT "cash_payments_cashSessionId_fkey"
  FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_payments" ADD CONSTRAINT "cash_payments_receivedById_fkey"
  FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_service_config" ADD CONSTRAINT "cash_service_config_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_service_config_audits" ADD CONSTRAINT "cash_service_config_audits_configId_fkey"
  FOREIGN KEY ("configId") REFERENCES "cash_service_config"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_service_config_audits" ADD CONSTRAINT "cash_service_config_audits_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "cash_registers" ("name", "active") VALUES ('Caja Principal', true)
ON CONFLICT ("name") DO NOTHING;
INSERT INTO "cash_service_config" ("id", "servicePercent") VALUES (1, 0)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "permissions" ("name", "description", "createdAt", "updatedAt") VALUES
  ('cash.read', 'Consultar sesión y cuentas pendientes de Caja', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cash.operate', 'Operar cuentas, prefacturas y pagos de Caja', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cash.configure', 'Configurar servicio voluntario y cajas', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cash.reports', 'Consultar reportes financieros e historial de Caja', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId", "createdAt", "updatedAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "roles" r CROSS JOIN "permissions" p
WHERE r."name" IN ('admin', 'super')
  AND p."name" IN ('cash.read', 'cash.operate', 'cash.configure', 'cash.reports')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
