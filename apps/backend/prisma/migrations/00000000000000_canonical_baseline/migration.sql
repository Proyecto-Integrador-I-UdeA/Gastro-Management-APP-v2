-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('PURCHASE', 'TRANSFER', 'WASTE', 'CONSUMPTION');

-- CreateEnum
CREATE TYPE "ProductBaseUnit" AS ENUM ('g', 'ml', 'und');

-- CreateTable
CREATE TABLE "suppliers" (
    "id" SERIAL NOT NULL,
    "internalCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientCatalog" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "caloriesPer100g" DOUBLE PRECISION,
    "carbsPer100g" DOUBLE PRECISION,
    "fatPer100g" DOUBLE PRECISION,
    "proteinPer100g" DOUBLE PRECISION,
    "sugarPer100g" DOUBLE PRECISION,
    "sodiumPer100g" DOUBLE PRECISION,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "IngredientCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "internalCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "isIngredient" BOOLEAN NOT NULL DEFAULT false,
    "isSupply" BOOLEAN NOT NULL DEFAULT false,
    "isFinishedProduct" BOOLEAN NOT NULL DEFAULT false,
    "presentation" TEXT NOT NULL,
    "inputUnit" TEXT NOT NULL DEFAULT 'g',
    "inputUnitQuantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "minStock" DOUBLE PRECISION NOT NULL,
    "maxStock" DOUBLE PRECISION NOT NULL,
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "supplierId" INTEGER NOT NULL,
    "caloriesPer100g" DOUBLE PRECISION,
    "carbsPer100g" DOUBLE PRECISION,
    "fatPer100g" DOUBLE PRECISION,
    "proteinPer100g" DOUBLE PRECISION,
    "sodiumPer100g" DOUBLE PRECISION,
    "sugarPer100g" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unitOfMeasure" "ProductBaseUnit" NOT NULL DEFAULT 'g',
    "catalogId" INTEGER,
    "isSeedProduct" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventories" (
    "id" SERIAL NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT,
    "roleId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" SERIAL NOT NULL,
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" SERIAL NOT NULL,
    "internalCode" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "batchQuantity" DOUBLE PRECISION NOT NULL,
    "portions" INTEGER NOT NULL,
    "totalCost" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caloriesPerPortion" DOUBLE PRECISION,
    "carbsPerPortion" DOUBLE PRECISION,
    "fatPerPortion" DOUBLE PRECISION,
    "nutritionScore" DOUBLE PRECISION,
    "proteinPerPortion" DOUBLE PRECISION,
    "sodiumPerPortion" DOUBLE PRECISION,
    "sugarPerPortion" DOUBLE PRECISION,
    "costClassification" TEXT,
    "macroDominance" TEXT,
    "nutritionRole" TEXT,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_items" (
    "id" SERIAL NOT NULL,
    "recipeId" INTEGER NOT NULL,
    "productId" INTEGER,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "totalCost" DECIMAL(10,2) NOT NULL,
    "subRecipeId" INTEGER,

    CONSTRAINT "recipe_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_processes" (
    "id" SERIAL NOT NULL,
    "recipeId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "processType" TEXT NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "operators" INTEGER NOT NULL,
    "stepDescription" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "recipe_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "costs" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "monthlyValue" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "other_costs" (
    "id" SERIAL NOT NULL,
    "month" TEXT NOT NULL,
    "fixedCosts" DOUBLE PRECISION NOT NULL,
    "variableCosts" DOUBLE PRECISION NOT NULL,
    "payroll" DOUBLE PRECISION NOT NULL,
    "monthlyProduction" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "other_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variable_costs" (
    "id" SERIAL NOT NULL,
    "month" TEXT NOT NULL,
    "packagingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wastePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentProcessingPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platformCommissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "extraVariableCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variable_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_categories" (
    "id" SERIAL NOT NULL,
    "month" TEXT NOT NULL,
    "production" DOUBLE PRECISION NOT NULL,
    "operation" DOUBLE PRECISION NOT NULL,
    "distribution" DOUBLE PRECISION NOT NULL,
    "commercial" DOUBLE PRECISION NOT NULL,
    "administration" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "hasDrink" BOOLEAN NOT NULL DEFAULT false,
    "hasDessert" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caloriesPerPortion" DOUBLE PRECISION,
    "carbsPerPortion" DOUBLE PRECISION,
    "fatPerPortion" DOUBLE PRECISION,
    "nutritionScore" DOUBLE PRECISION,
    "proteinPerPortion" DOUBLE PRECISION,
    "sodiumPerPortion" DOUBLE PRECISION,
    "sugarPerPortion" DOUBLE PRECISION,
    "totalCost" DECIMAL(10,2),

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItemComponent" (
    "id" SERIAL NOT NULL,
    "menuItemId" INTEGER NOT NULL,
    "productId" INTEGER,
    "recipeId" INTEGER,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "MenuItemComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_internalCode_key" ON "suppliers"("internalCode");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientCatalog_name_key" ON "IngredientCatalog"("name");

-- CreateIndex
CREATE UNIQUE INDEX "products_internalCode_key" ON "products"("internalCode");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_name_key" ON "warehouses"("name");

-- CreateIndex
CREATE UNIQUE INDEX "inventories_productId_warehouseId_key" ON "inventories"("productId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_internalCode_key" ON "recipes"("internalCode");

-- CreateIndex
CREATE UNIQUE INDEX "config_key_key" ON "config"("key");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "IngredientCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventories" ADD CONSTRAINT "inventories_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_subRecipeId_fkey" FOREIGN KEY ("subRecipeId") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_processes" ADD CONSTRAINT "recipe_processes_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemComponent" ADD CONSTRAINT "MenuItemComponent_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemComponent" ADD CONSTRAINT "MenuItemComponent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemComponent" ADD CONSTRAINT "MenuItemComponent_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
