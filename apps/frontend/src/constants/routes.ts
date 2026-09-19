export const ROUTES = {
  root: '/',
  dashboard: '/dashboard',
  login: '/login',
  register: '/register',
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
    counts: '/inventory/counts',
    newCount: '/inventory/counts/new',
  },
  reports: {
    root: '/reports',
    productsInventory: '/reports/products',
    suppliersCatalog: '/reports/suppliers',
    transfersSummary: '/reports/transfers',
    productionSummary: '/reports/production',
    costsSummary: '/reports/costs',
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
  sales: {
    root: '/sales',
    orders: '/sales/orders',
    menu: '/sales/menu',
    reservations: '/sales/reservations',
    newReservation: '/sales/reservations/new',
    cash: '/sales/cash',
  },
} as const;
