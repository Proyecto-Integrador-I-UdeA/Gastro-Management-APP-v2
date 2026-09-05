export type PermissionDefinition = {
  name: string;
  description: string;
};

export const businessPermissions: readonly PermissionDefinition[] = [
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

  // PRODUCCIÓN
  { name: 'recipes.read', description: 'Ver recetas' },
  { name: 'recipes.create', description: 'Crear recetas' },
  { name: 'recipes.update', description: 'Editar recetas' },

  // MENÚ
  { name: 'menu.read', description: 'Consultar menú y categorías' },
  { name: 'menu.manage', description: 'Administrar menú y categorías' },

  // COSTOS
  { name: 'costs.read', description: 'Ver costos' },
  { name: 'costs.update', description: 'Editar costos' },

  // CONTABILIDAD
  { name: 'accounting.read', description: 'Ver contabilidad' },
  { name: 'accounting.update', description: 'Editar contabilidad' },

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

export const platformPermissions: readonly PermissionDefinition[] = [];

export const permissions: readonly PermissionDefinition[] = [
  ...businessPermissions,
  ...platformPermissions,
];

export function createRolePermissions(
  business: readonly PermissionDefinition[] = businessPermissions,
  platform: readonly PermissionDefinition[] = platformPermissions,
) {
  return {
    super: [...business, ...platform].map(permission => permission.name),
    admin: business.map(permission => permission.name),

    chef: [
      'recipes.read', 'recipes.create', 'recipes.update',
      'products.read',
      'menu.read', 'menu.manage',
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
      'reports.read',
      'profile.update',
    ],

    accounting: [
      'costs.read', 'costs.update',
      'sales.read',
      'reports.read',
      'profile.update',
    ],
  };
}

export const rolePermissions = createRolePermissions();
