import { PrismaClient } from '@prisma/client';
import { permissions, rolePermissions } from './permissionConfig';



const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');


  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: perm,
      create: perm,
    });
  }

  for (const [roleName, perms] of Object.entries(rolePermissions)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });

    for (const permName of perms) {
      const permission = await prisma.permission.findUnique({
        where: { name: permName },
      });

      if (permission) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }
  }

  const warehouseCount = await prisma.warehouse.count();

  await prisma.warehouse.upsert({
    where: { name: 'Bodega Principal' },
    update: {
      description: 'Almacén general',
      active: true,
    },
    create: {
      name: 'Bodega Principal',
      description: 'Almacén general',
      active: true,
      isMain: warehouseCount === 0,
    },
  });

  await prisma.warehouse.upsert({
    where: { name: 'Cocina' },
    update: {
      description: 'Insumos en cocina',
      active: true,
    },
    create: {
      name: 'Cocina',
      description: 'Insumos en cocina',
      active: true,
      isMain: false,
    },
  });
  console.log('Seed completado correctamente 🚀');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
