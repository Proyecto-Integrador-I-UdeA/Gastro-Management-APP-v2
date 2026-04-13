-- Tablas del módulo de costos / config (existían en schema.prisma sin migración previa)
CREATE TABLE IF NOT EXISTS "costs" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "monthlyValue" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "costs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "config" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "config_key_key" ON "config"("key");

CREATE TABLE IF NOT EXISTS "other_costs" (
    "id" SERIAL NOT NULL,
    "month" TEXT NOT NULL,
    "fixedCosts" DOUBLE PRECISION NOT NULL,
    "variableCosts" DOUBLE PRECISION NOT NULL,
    "payroll" DOUBLE PRECISION NOT NULL,
    "monthlyProduction" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "other_costs_pkey" PRIMARY KEY ("id")
);
