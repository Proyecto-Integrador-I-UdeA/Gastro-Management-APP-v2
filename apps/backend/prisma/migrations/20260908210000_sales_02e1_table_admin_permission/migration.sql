-- Register the narrow DiningTable master-data permission without changing the Prisma schema.
INSERT INTO "permissions" ("name", "description", "createdAt", "updatedAt")
VALUES (
    'sales.tables.manage',
    'Configurar mesas del restaurante',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO NOTHING;

-- Grant table configuration only to the existing administrative roles.
INSERT INTO "role_permissions" ("roleId", "permissionId", "createdAt", "updatedAt")
SELECT
    r."id",
    p."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "roles" AS r
CROSS JOIN "permissions" AS p
WHERE r."name" IN ('super', 'admin')
  AND p."name" = 'sales.tables.manage'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
