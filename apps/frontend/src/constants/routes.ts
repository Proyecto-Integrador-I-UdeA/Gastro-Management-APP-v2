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
    /** Código interno en la URL (evita espacios/caracteres del nombre). El filtro real es `supplierId`. */
    listBySupplier: (id: string | number, internalCode: string) =>
      `/products?supplierId=${encodeURIComponent(String(id))}&supplierCode=${encodeURIComponent(internalCode)}`,
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
  inventory: {
    list: '/inventory',
  },
  reports: {
    root: '/reports',
    productsInventory: '/reports/products',
    suppliersCatalog: '/reports/suppliers',
    transfersSummary: '/reports/transfers',
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
