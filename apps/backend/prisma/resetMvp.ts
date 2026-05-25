import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Iniciando limpieza MVP...");

  await prisma.inventoryMovement.deleteMany();
  console.log("✅ inventoryMovement limpio");

  await prisma.inventory.deleteMany();
  console.log("✅ inventory limpio");

  await prisma.menuItemComponent.deleteMany();
  console.log("✅ menuItemComponent limpio");

  await prisma.menuItem.deleteMany();
  console.log("✅ menuItem limpio");

  await prisma.recipeItem.deleteMany();
  console.log("✅ recipeItem limpio");

  await prisma.recipeProcess.deleteMany();
  console.log("✅ recipeProcess limpio");

  await prisma.recipe.deleteMany();
  console.log("✅ recipe limpio");

  await prisma.product.deleteMany();
  console.log("✅ product limpio");

  console.log("🎉 Reset MVP completado");
}

main()
  .catch((error) => {
    console.error("❌ Error en reset:", error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });























