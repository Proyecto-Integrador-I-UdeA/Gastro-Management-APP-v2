import { describe, expect, it } from 'vitest';
import {
  businessPermissions,
  createRolePermissions,
  permissions,
  rolePermissions,
} from '../../prisma/permissionConfig';

const menuPermissions = ['menu.read', 'menu.manage', 'menu.availability.manage'];
const salePricePermissions = ['costs.prices.read', 'costs.prices.manage'];
const salesPermissions = ['sales.read', 'sales.manage'];
const tableAdministrationPermission = 'sales.tables.manage';
const kitchenPermissions = ['kitchen.read', 'kitchen.manage'];

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
    expect(rolePermissions.accounting).not.toContain('menu.availability.manage');
    expect(rolePermissions.purchases).not.toContain('menu.availability.manage');
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

  it('reserva la gestión operativa de ventas para admin y super', () => {
    const businessPermissionNames = businessPermissions.map(permission => permission.name);

    expect(businessPermissionNames).toEqual(expect.arrayContaining(salesPermissions));
    expect(rolePermissions.admin).toEqual(expect.arrayContaining(salesPermissions));
    expect(rolePermissions.super).toEqual(expect.arrayContaining(salesPermissions));
    expect(rolePermissions.accounting).toContain('sales.read');
    expect(rolePermissions.accounting).not.toContain('sales.manage');
    expect(rolePermissions.purchases).not.toContain('sales.manage');
    expect(rolePermissions.chef).not.toContain('sales.manage');
  });

  it('reserva la configuración de mesas para admin y super', () => {
    const businessPermissionNames = businessPermissions.map(permission => permission.name);

    expect(businessPermissionNames).toContain(tableAdministrationPermission);
    expect(rolePermissions.admin).toContain(tableAdministrationPermission);
    expect(rolePermissions.super).toContain(tableAdministrationPermission);
    expect(rolePermissions.accounting).not.toContain(tableAdministrationPermission);
    expect(rolePermissions.purchases).not.toContain(tableAdministrationPermission);
    expect(rolePermissions.chef).not.toContain(tableAdministrationPermission);
  });

  it('asigna Kitchen a chef, admin y super, pero no a accounting ni purchases', () => {
    const businessPermissionNames = businessPermissions.map(permission => permission.name);

    expect(businessPermissionNames).toEqual(expect.arrayContaining(kitchenPermissions));
    expect(rolePermissions.chef).toEqual(expect.arrayContaining(kitchenPermissions));
    expect(rolePermissions.admin).toEqual(expect.arrayContaining(kitchenPermissions));
    expect(rolePermissions.super).toEqual(expect.arrayContaining(kitchenPermissions));
    for (const permission of kitchenPermissions) {
      expect(rolePermissions.accounting).not.toContain(permission);
      expect(rolePermissions.purchases).not.toContain(permission);
    }
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
