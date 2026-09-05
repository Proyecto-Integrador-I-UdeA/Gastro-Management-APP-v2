INSERT INTO "role_permissions" ("roleId", "permissionId", "createdAt", "updatedAt")
SELECT
    r."id",
    p."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "roles" AS r
CROSS JOIN "permissions" AS p
WHERE r."name" = 'admin'
  AND p."name" IN (
    'users.read',
    'users.create',
    'users.update',
    'users.delete',
    'products.read',
    'products.create',
    'products.update',
    'products.delete',
    'suppliers.read',
    'suppliers.create',
    'suppliers.update',
    'suppliers.delete',
    'recipes.read',
    'recipes.create',
    'recipes.update',
    'costs.read',
    'costs.update',
    'accounting.read',
    'accounting.update',
    'sales.read',
    'reports.read',
    'inventory.read',
    'inventory.create',
    'transfers.read',
    'transfers.create',
    'transfers.update',
    'transfers.delete',
    'warehouses.read',
    'warehouses.create',
    'warehouses.update',
    'profile.update'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
