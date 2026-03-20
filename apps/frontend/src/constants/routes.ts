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
} as const;
