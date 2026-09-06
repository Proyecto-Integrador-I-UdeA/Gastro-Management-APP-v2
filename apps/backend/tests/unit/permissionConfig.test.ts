import { describe, expect, it } from 'vitest';
import {
  businessPermissions,
  createRolePermissions,
  permissions,
  rolePermissions,
} from '../../prisma/permissionConfig';

const menuPermissions = ['menu.read', 'menu.manage'];
const salePricePermissions = ['costs.prices.read', 'costs.prices.manage'];

describe('configuración de permisos por rol', () => {
  it('asigna al rol admin todos los permisos de negocio actuales', () => {
    const businessPermissionNames = businessPermissions.map(permission => permission.name);

    expect(rolePermissions.admin).toEqual(businessPermissionNames);
    expect(rolePermissions.admin).toEqual(expect.arrayContaining(menuPermissions));
  });

  it('asigna al rol super todos los permisos existentes', () => {
    const permissionNames = permissions.map(permission => permission.name);

    expect(rolePermissions.super).toEqual(permissionNames);
    expect(rolePermissions.super).toEqual(expect.arrayContaining(menuPermissions));
  });

  it('declara los permisos de menú como negocio y los asigna explícitamente a chef', () => {
    const businessPermissionNames = businessPermissions.map(permission => permission.name);

    expect(businessPermissionNames).toEqual(expect.arrayContaining(menuPermissions));
    expect(rolePermissions.chef).toEqual(expect.arrayContaining(menuPermissions));
  });

  it('asigna permisos de precios a admin/super y solo lectura a accounting', () => {
    const businessPermissionNames = businessPermissions.map(permission => permission.name);

    expect(businessPermissionNames).toEqual(expect.arrayContaining(salePricePermissions));
    expect(rolePermissions.admin).toEqual(expect.arrayContaining(salePricePermissions));
    expect(rolePermissions.super).toEqual(expect.arrayContaining(salePricePermissions));
    expect(rolePermissions.accounting).toContain('costs.prices.read');
    expect(rolePermissions.accounting).not.toContain('costs.prices.manage');
    expect(rolePermissions.chef).not.toEqual(expect.arrayContaining(salePricePermissions));
    expect(rolePermissions.purchases).not.toEqual(expect.arrayContaining(salePricePermissions));
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
