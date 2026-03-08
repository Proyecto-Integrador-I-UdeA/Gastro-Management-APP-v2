'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-circle">
          <i className="fa-solid fa-utensils"></i>
        </div>
        <div className="logo-text">
          <h1>Gastronomic</h1>
          <h2>Management App</h2>
          <p>Precisión culinaria, rentabilidad garantizada.</p>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        <Link href="/" className={`nav-item ${pathname === '/' || pathname.includes('producto') ? 'active' : ''}`}>
          <i className="fa-solid fa-cart-shopping"></i>
          <span>Inventario</span>
        </Link>
        <Link href="#" className="nav-item">
          <i className="fa-solid fa-clipboard-list"></i>
          <span>Recetas</span>
        </Link>
        <Link href="#" className="nav-item">
          <i className="fa-solid fa-dollar-sign"></i>
          <span>Costos</span>
        </Link>
        <Link href="#" className="nav-item">
          <i className="fa-solid fa-chart-simple"></i>
          <span>Reportes</span>
        </Link>
        <Link href="#" className="nav-item">
          <i className="fa-solid fa-cube"></i>
          <span>Configuración</span>
        </Link>
      </nav>
    </aside>
  );
}
