import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';


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
    { name: 'transfers.read', description: 'Ver traslados' },

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
      'recipes.read', 'recipes.create', 'recipes.update',

      // INVENTARIO
      'inventory.read',
      'transfers.read',
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
      'transfers.read',
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

// 🔥 CREAR USUARIO SUPERUSUARIO
const passwordHash = await bcrypt.hash("12345678", 10);

// buscar rol "super"
const superRole = await prisma.role.findUnique({
  where: { name: "super" }
});

if (!superRole) {
  throw new Error("❌ Rol 'super' no encontrado");
}

await prisma.user.upsert({
  where: { email: "admin@gastro.com" },
  update: {},
  create: {
    email: "admin@gastro.com",
    passwordHash,
    fullName: "Super Admin",
    roleId: superRole.id,
  },
});
  console.log('Seed completado correctamente 🚀');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());