import { PrismaClient } from '@prisma/client';



const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');


  // 🔥 PERMISOS ESTANDARIZADOS 
  const permissions = [
    // USERS
    { name: 'users.read', description: 'Ver usuarios' },
    { name: 'users.create', description: 'Crear usuarios' },
    { name: 'users.update', description: 'Editar usuarios' },
    { name: 'users.delete', description: 'Inactivar usuarios' },

    // PRODUCTS
    { name: 'products.read', description: 'Ver productos' },
    { name: 'products.create', description: 'Crear productos' },
    { name: 'products.update', description: 'Editar productos' },
    { name: 'products.delete', description: 'Eliminar productos' },

    // SUPPLIERS
    { name: 'suppliers.read', description: 'Ver proveedores' },
    { name: 'suppliers.create', description: 'Crear proveedores' },
    { name: 'suppliers.update', description: 'Editar proveedores' },
    { name: 'suppliers.delete', description: 'Eliminar proveedores' },

    //  PRODUCCIÓN
    { name: 'recipes.read', description: 'Ver recetas' },
    { name: 'recipes.create', description: 'Crear recetas' },
    { name: 'recipes.update', description: 'Editar recetas' },

    // COSTOS / CONTABLE
    { name: 'costs.read', description: 'Ver costos' },
    { name: 'costs.update', description: 'Editar costos' },

    // VENTAS / REPORTES
    { name: 'sales.read', description: 'Ver ventas' },
    { name: 'reports.read', description: 'Ver reportes' },

    // INVENTARIO / LOGÍSTICA
    { name: 'inventory.read', description: 'Ver inventario' },
    { name: 'inventory.create', description: 'Registrar compras, mermas y consumos' },
    { name: 'transfers.read', description: 'Ver traslados' },
    { name: 'transfers.create', description: 'Registrar traslados entre bodegas' },
    { name: 'transfers.update', description: 'Editar traslados' },
    { name: 'transfers.delete', description: 'Eliminar traslados (revierte stock)' },
    { name: 'warehouses.read', description: 'Ver bodegas' },
    { name: 'warehouses.create', description: 'Crear bodegas' },
    { name: 'warehouses.update', description: 'Editar bodegas' },
    

    // PERFIL
    { name: 'profile.update', description: 'Cambiar contraseña' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: perm,
      create: perm,
    });
  }

  // 🔥 ROLES AJUSTADOS A LA REGLA DE NEGOCIO
  const rolePermissions = {
    super: permissions.map(p => p.name), // TODO

    admin: [
      // SOLO LECTURA DE USUARIOS
      'users.read',

      // FULL PRODUCTOS Y PROVEEDORES
      'products.read', 'products.create', 'products.update', 'products.delete',
      'suppliers.read', 'suppliers.create', 'suppliers.update', 'suppliers.delete',

      // RECETAS
      'recipes.read',

      // INVENTARIO / BODEGAS
      'inventory.read',
      'inventory.create',
      'transfers.read',
      'transfers.create',
      'transfers.update',
      'transfers.delete',
      'warehouses.read',
      'warehouses.create',
      'warehouses.update',
      // REPORTES
      'reports.read',

      // PERFIL
      'profile.update',
    ],

    chef: [
      'recipes.read', 'recipes.create', 'recipes.update',
      'products.read',
      'profile.update',
    ],

    purchases: [
      'products.read', 'products.create', 'products.update', 'products.delete',
      'suppliers.read', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
      'inventory.read',
      'inventory.create',
      'transfers.read',
      'transfers.create',
      'transfers.update',
      'transfers.delete',
      'warehouses.read',
      'warehouses.create',
      'warehouses.update',
      'profile.update',
    ],

    accounting: [
      'costs.read', 'costs.update',
      'sales.read',
      'reports.read',
      'profile.update',
    ],
  };

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

await prisma.warehouse.updateMany({ data: { isMain: false } });

await prisma.warehouse.upsert({
  where: { name: 'Bodega Principal' },
  update: {
    description: 'Almacén general',
    active: true,
    isMain: true,
  },
  create: {
    name: 'Bodega Principal',
    description: 'Almacén general',
    active: true,
    isMain: true,
  },
});

await prisma.warehouse.upsert({
  where: { name: 'Cocina' },
  update: {
    description: 'Insumos en cocina',
    active: true,
    isMain: false,
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