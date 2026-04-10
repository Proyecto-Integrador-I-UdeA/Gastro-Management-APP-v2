-- Idempotente: seguro si la BD ya tenía parte del esquema (p. ej. prisma db push) o un intento fallido.

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "MovementType" AS ENUM ('PURCHASE', 'TRANSFER', 'WASTE', 'CONSUMPTION');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable products (columnas sueltas para no fallar si algo ya existe)
ALTER TABLE "products" DROP COLUMN IF EXISTS "expirationDate";
ALTER TABLE "products" DROP COLUMN IF EXISTS "currentStock";
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "inputUnit" TEXT NOT NULL DEFAULT 'g';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "inputUnitQuantity" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "products_internalCode_key" ON "products"("internalCode");

-- CreateTable
CREATE TABLE IF NOT EXISTS "warehouses" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "warehouses_name_key" ON "warehouses"("name");

CREATE TABLE IF NOT EXISTS "inventories" (
    "id" SERIAL NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,

    CONSTRAINT "inventories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "inventories_productId_warehouseId_key" ON "inventories"("productId", "warehouseId");

CREATE TABLE IF NOT EXISTS "inventory_movements" (
    "id" SERIAL NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitCost" DECIMAL(10,2),
    "expirationDate" TIMESTAMP(3),
    "notes" TEXT,
    "productId" INTEGER NOT NULL,
    "sourceWarehouseId" INTEGER,
    "destinationWarehouseId" INTEGER,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey (ignorar si ya existen)
DO $$ BEGIN
    ALTER TABLE "inventories" ADD CONSTRAINT "inventories_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "inventories" ADD CONSTRAINT "inventories_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
