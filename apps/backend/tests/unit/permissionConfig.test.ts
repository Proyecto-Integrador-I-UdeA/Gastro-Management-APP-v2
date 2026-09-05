import { describe, expect, it } from 'vitest';
import {
  businessPermissions,
  createRolePermissions,
  permissions,
  rolePermissions,
} from '../../prisma/permissionConfig';

describe('configuración de permisos por rol', () => {
  it('asigna al rol admin todos los permisos de negocio actuales', () => {
    const businessPermissionNames = businessPermissions.map(permission => permission.name);

    expect(rolePermissions.admin).toEqual(businessPermissionNames);
  });

  it('asigna al rol super todos los permisos existentes', () => {
    const permissionNames = permissions.map(permission => permission.name);

    expect(rolePermissions.super).toEqual(permissionNames);
  });

  it('mantiene un permiso futuro de plataforma fuera del rol admin', () => {
    const futurePlatformPermission = {
      name: 'platform.tenants.manage',
      description: 'Administrar tenants de la plataforma',
    };
    const futureRolePermissions = createRolePermissions(
      businessPermissions,
      [futurePlatformPermission],
    );

    expect(futureRolePermissions.super).toContain(futurePlatformPermission.name);
    expect(futureRolePermissions.admin).not.toContain(futurePlatformPermission.name);
    expect(futureRolePermissions.admin).toEqual(
      businessPermissions.map(permission => permission.name),
    );
  });
});
