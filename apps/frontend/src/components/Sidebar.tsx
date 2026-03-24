'use client';
import { useRouter, usePathname } from 'next/navigation';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: '📈' },
    { name: 'Productos', path: '/products', icon: '📦' },
    { name: 'Proveedores', path: '/suppliers', icon: '🚚' },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-72 bg-[#001F3F] text-white flex flex-col">

      {/* Espacio superior */}
      <div className="h-24 flex items-center justify-center border-b border-white/10"></div>

      {/* Menú */}
      <nav className="flex flex-col mt-4">

        {menuItems
          .filter((item) => {
            // 🔥 lógica para ocultar según página
            if (pathname === '/products' && item.path === '/products') return false;
            if (pathname === '/suppliers' && item.path === '/suppliers') return false;
            return true;
          })
          .map((item) => {
            const active = pathname === item.path;

            return (
              <button
                key={item.name}
                onClick={() => router.push(item.path)}
                className={`
                  flex items-center gap-4 px-6 py-4 text-left
                  transition-all duration-200
                  ${
                    active
                      ? 'bg-[#3A5F77] font-semibold'
                      : 'hover:bg-[#33566E]'
                  }
                `}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-lg">{item.name}</span>
              </button>
            );
          })}

      </nav>

      {/* 🔥 IMAGEN ABAJO (NUEVO) */}
      <div className="mt-auto p-4">
       <img
  src={
    pathname === '/suppliers'
      ? '/images/sidebar-proveedores.jpg'
      : '/images/sidebar-productos.jpg'
  }
  alt="Gestión"
  className="w-full h-80 object-cover shadow-md border border-white/10"
/> 
      </div>

    </aside>
  );
}