"use client";

import { useRouter, usePathname } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { useEffect, useState } from "react";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const sidebar = useSidebar();
  if (!sidebar) return null;

  const { open, setOpen } = sidebar;

  const safePath = pathname || "";
  const isDashboard = safePath === "/dashboard";

  // 🔥 (se deja pero ya no se usa para validar)
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (globalThis.window !== undefined) {
      const token = localStorage.getItem("token");

      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          setPermissions(payload.permissions || []);
        } catch (e) {
          console.error("Error leyendo token", e);
          setPermissions([]);
        }
      }
    }
  }, []);

  // 🔥 VALIDACIÓN REAL DESDE TOKEN
  const can = (permissions: string) => {
    if (globalThis.window === undefined) return false;

    const token = localStorage.getItem("token");
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      console.log("PERMISO QUE SE ENVÍA:", permissions);
      console.log("PERMISOS DEL USUARIO:", payload.permissions);

      return payload.permissions?.includes(permissions);
    } catch {
      return false;
    }
  };

  const handleNavigate = (path: string, permission?: string) => {
    if (permission && !can(permission)) {
      alert("No cuentas con los permisos para ingresar a este modulo");
      return;
    }

    router.push(path);
    setOpen(false);
  };

  const menuItems = [
    { name: "Dashboard", path: "/dashboard", icon: "📈" },
    { name: "Productos", path: "/products", icon: "📦", permission: "products.read" },
    { name: "Proveedores", path: "/suppliers", icon: "🚚", permission: "suppliers.read" },
  ];

  return (
    <>
      {/* OVERLAY */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setOpen(false)} // 🔥 FIX (no navegación aquí)
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-72 bg-[#001F3F] text-white flex flex-col z-50
          transform transition-transform duration-300
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:flex
        `}
      >
        <div className="h-24 flex items-center justify-center border-b border-white/10"></div>

        <nav className="flex flex-col mt-4">
          {isDashboard ? (
            <>
              <button
                onClick={() => handleNavigate("/users/create", "users.create")}
                className="flex items-center gap-4 px-6 py-4 hover:bg-[#33566E]"
              >
                👤 <span className="text-lg">Crear Usuario</span>
              </button>

              <button
                onClick={() => handleNavigate("/users", "users.read")}
                className="flex items-center gap-4 px-6 py-4 hover:bg-[#33566E]"
              >
                📋 <span className="text-lg">Ver Usuarios</span>
              </button>
            </>
          ) : (
            menuItems
              .filter((item) => !safePath.startsWith(item.path))
              .map((item) => (
                <button
                  key={item.name}
                  onClick={() => handleNavigate(item.path, item.permission)}
                  className="flex items-center gap-4 px-6 py-4 text-left hover:bg-[#33566E]"
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-lg">{item.name}</span>
                </button>
              ))
          )}
        </nav>

        <div className="mt-auto p-4">
          <img
            src={
              safePath.includes("/suppliers/create")
                ? "/images/sidebar-proveedores-create.jpg"
                : safePath.includes("/suppliers/edit")
                ? "/images/sidebar-proveedores-edit.jpg"
                : safePath.includes("/suppliers")
                ? "/images/sidebar-proveedores.jpg"
                : safePath.includes("/products/create")
                ? "/images/sidebar-productos-create.jpg"
                : safePath.includes("/products/edit")
                ? "/images/sidebar-productos-edit.jpg"
                : safePath.includes("/products")
                ? "/images/sidebar-productos.jpg"
                : safePath.includes("/users/create")
                ? "/images/sidebar-users-create.jpg"
                : safePath.includes("/users/edit")
                ? "/images/sidebar-users-edit.jpg"
                : safePath.includes("/users")
                ? "/images/sidebar-users.jpg"
                : safePath.includes("/dashboard")
                ? "/images/sidebar-dashboard.jpg"
                : "/images/sidebar-default.jpg"
            }
            alt="Gestión"
            className="w-full h-60 object-cover shadow-md border border-white/10 rounded-lg"
          />
        </div>
      </aside>
    </>
  );
}