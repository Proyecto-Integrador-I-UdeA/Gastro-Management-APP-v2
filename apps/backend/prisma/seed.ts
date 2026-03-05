import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed de roles...');

  const roles = [
    { name: 'super', description: 'Super usuario - acceso total a todo' },
    { name: 'admin', description: 'Administrador del establecimiento' },
    { name: 'chef', description: 'Chef o cocinero principal' },
    { name: 'purchases', description: 'Jefe de compras e inventarios' },
    { name: 'accounting', description: 'Contabilidad y finanzas' },
  ];

  for (const role of roles) {
    const created = await prisma.role.upsert({
      where: { name: role.name },
      update: role,
      create: role,
    });
    console.log(`Rol creado/actualizado: ${created.name} (ID: ${created.id})`);
  }

  console.log('Seed de roles completado exitosamente');
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });