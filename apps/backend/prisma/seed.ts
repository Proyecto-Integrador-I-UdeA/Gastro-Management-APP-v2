import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  // Crear permisos
  const permissions = [
    { name: 'users:read', description: 'Ver lista de usuarios' },
    { name: 'users:create', description: 'Registrar usuarios' },
    { name: 'users:update', description: 'Editar usuarios' },
    { name: 'users:delete', description: 'Inactivar usuarios' },
    { name: 'suppliers:read', description: 'Ver proveedores' },
    { name: 'suppliers:create', description: 'Crear proveedores' },
    { name: 'suppliers:update', description: 'Editar proveedores' },
    { name: 'suppliers:delete', description: 'Eliminar proveedores' },
    { name: 'products:read', description: 'Ver inventario' },
    { name: 'products:create', description: 'Agregar productos' },
    { name: 'products:update', description: 'Editar productos' },
    { name: 'products:delete', description: 'Eliminar productos' },
    { name: 'recipes:read', description: 'Ver recetas' },
    { name: 'recipes:create', description: 'Crear recetas' },
    { name: 'recipes:update', description: 'Editar recetas' },
    { name: 'costs:read', description: 'Ver costos' },
    { name: 'costs:update', description: 'Actualizar costos' },
    { name: 'pricing:read', description: 'Ver precios' },
    { name: 'pricing:update', description: 'Ajustar precios' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: perm,
      create: perm,
    });
  }

  // Crear roles y asignar permisos
  const rolePermissions = {
    super: permissions.map(p => p.name), // todos los permisos
    admin: [
      'users:read', 'users:create', 'users:update', 'users:delete',
      'suppliers:read', 'suppliers:create', 'suppliers:update', 'suppliers:delete',
      'products:read', 'products:create', 'products:update', 'products:delete',
      'recipes:read', 'recipes:create', 'recipes:update',
      'costs:read', 'costs:update',
      'pricing:read', 'pricing:update',
    ],
    chef: ['recipes:read', 'recipes:create', 'recipes:update', 'products:read'],
    purchases: ['suppliers:read', 'suppliers:create', 'suppliers:update', 'suppliers:delete', 'products:read', 'products:create', 'products:update', 'products:delete'],
    accounting: ['costs:read', 'costs:update', 'pricing:read', 'pricing:update', 'products:read'],
  };

  for (const [roleName, perms] of Object.entries(rolePermissions)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: { name: roleName },
      create: { name: roleName, description: `${roleName} role` },
    });

    // Asignar permisos al rol
    for (const permName of perms) {
      const permission = await prisma.permission.findUnique({ where: { name: permName } });
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

  console.log('Seed completado: roles y permisos creados');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());