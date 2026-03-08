-- CreateTable
CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "internalCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "internalCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isIngredient" BOOLEAN NOT NULL,
    "isSupply" BOOLEAN NOT NULL,
    "isFinishedProduct" BOOLEAN NOT NULL,
    "presentation" TEXT NOT NULL,
    "unitOfMeasure" TEXT NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "minStock" DOUBLE PRECISION NOT NULL,
    "maxStock" DOUBLE PRECISION NOT NULL,
    "currentStock" DOUBLE PRECISION NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "supplierId" INTEGER NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
