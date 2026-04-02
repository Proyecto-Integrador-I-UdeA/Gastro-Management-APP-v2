export const ROUTES = {
  root: '/',
  dashboard: '/dashboard',
  login: '/login',
  users: {
    list: '/users',
    create: '/users/create',
    edit: (id: string | number) => `/users/edit/${id}`,
  },
  products: {
    list: '/products',
    create: '/products/create',
    edit: (id: string | number) =>
      `/products/edit?id=${encodeURIComponent(String(id))}`,
  },
  suppliers: {
    list: '/suppliers',
    create: '/suppliers/create',
    edit: (id: string | number) =>
      `/suppliers/edit?id=${encodeURIComponent(String(id))}`,
  },
  transfers: {
    list: '/transfers',
    create: '/transfers/create',
    edit: (id: string | number) =>
      `/transfers/edit?id=${encodeURIComponent(String(id))}`,
    warehouses: '/transfers/warehouses',
    warehousesCreate: '/transfers/warehouses/create',
    warehouseEdit: (id: string | number) =>
      `/transfers/warehouses/edit?id=${encodeURIComponent(String(id))}`,
  },
} as const;
