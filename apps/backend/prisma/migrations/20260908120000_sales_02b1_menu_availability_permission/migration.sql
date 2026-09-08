-- Register the narrow operational permission without changing the Prisma schema.
INSERT INTO "permissions" ("name", "description", "createdAt", "updatedAt")
VALUES (
    'menu.availability.manage',
    'Administrar disponibilidad operativa del menú',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO NOTHING;

-- Grant it only to existing roles that already administer business/menu operations.
INSERT INTO "role_permissions" ("roleId", "permissionId", "createdAt", "updatedAt")
SELECT
    r."id",
    p."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "roles" AS r
CROSS JOIN "permissions" AS p
WHERE r."name" IN ('super', 'admin', 'chef')
  AND p."name" = 'menu.availability.manage'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
