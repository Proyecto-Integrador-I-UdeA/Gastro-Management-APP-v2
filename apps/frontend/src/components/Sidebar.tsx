'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/constants/routes';

type NavLink = {
  href: string;
  label: string;
  icon: string;
  /** Si está definido, la ruta activa coincide con este prefijo (p. ej. /products para create/edit). */
  prefix?: string;
};

const navLinks: NavLink[] = [
  { href: ROUTES.dashboard, label: 'Dashboard', icon: 'fa-chart-line' },
  { href: ROUTES.products.list, label: 'Productos', icon: 'fa-boxes-stacked', prefix: '/products' },
  { href: ROUTES.suppliers.list, label: 'Proveedores', icon: 'fa-truck-field', prefix: '/suppliers' },
];

function isActive(pathname: string, href: string, prefix?: string) {
  if (prefix) return pathname === href || pathname.startsWith(`${prefix}/`);
  return pathname === href || pathname === `${href}/`;
}

export default function Sidebar() {
  const pathname = usePathname() ?? '';

  return (
    <aside className="sidebar shrink-0">
      <div className="sidebar-header">
        <div className="logo-circle" aria-hidden>
          <i className="fa-solid fa-utensils" />
        </div>
        <div className="logo-text">
          <h1>Gastro</h1>
          <p>Management</p>
        </div>
      </div>
      <nav className="sidebar-nav" aria-label="Navegación principal">
        {navLinks.map(({ href, label, icon, prefix }) => (
          <Link
            key={href}
            href={href}
            className={`nav-item${isActive(pathname, href, prefix) ? ' active' : ''}`}
          >
            <i className={`fa-solid ${icon}`} aria-hidden />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
