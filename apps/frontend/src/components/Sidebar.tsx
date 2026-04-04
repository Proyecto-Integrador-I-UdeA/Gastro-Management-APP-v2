"use client";

import { useRouter, usePathname } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Folder,
  UserPlus,
  List,
} from "lucide-react";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const sidebar = useSidebar();
  if (!sidebar) return null;

  const { open, setOpen } = sidebar;

  const safePath = pathname || "";

  // 🔥 TIPOS DE VISTA
  const isDashboard = safePath === "/dashboard";

  const mainModules = [
    "/products",
    "/suppliers",
    "/production",
    "/costs",
    "/transfers",
    "/inventory",
    "/accounting",
    "/sales",
    "/reports",
  ];

  const isMainModule = mainModules.includes(safePath);

  const getParentModule = () => {
    if (safePath.startsWith("/products")) return "/products";
    if (safePath.startsWith("/suppliers")) return "/suppliers";
    if (safePath.startsWith("/production") || safePath.startsWith("/recipes")) return "/production";
    if (safePath.startsWith("/costs")) return "/costs";
    if (safePath.startsWith("/inventory")) return "/inventory";
    if (safePath.startsWith("/sales")) return "/sales";
    if (safePath.startsWith("/reports")) return "/reports";
    return null;
  };

  const parentModule = getParentModule();

  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");

      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          setPermissions(payload.permissions || []);
        } catch {
          setPermissions([]);
        }
      }
    }
  }, []);

  const can = (permission: string) => {
    if (typeof window === "undefined") return false;

    const token = localStorage.getItem("token");
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.permissions?.includes(permission);
    } catch {
      return false;
    }
  };

  // 🔥 NAVEGACIÓN LIMPIA
  const handleNavigate = (path: string) => {
    router.push(path);
    setOpen(false);

    // guardar última ruta
    localStorage.setItem("lastPath", path);
  };

  // 🎨 ESTILO BASE
  const baseBtn =
    "flex items-center gap-4 px-6 py-3 text-left transition-all duration-200 hover:bg-[#33566E] hover:pl-8";

  const disabledStyle = "opacity-30 cursor-not-allowed";

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setOpen(false)}
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
        <div className="h-24 flex items-center justify-center border-b border-white/10">
          <span className="text-lg font-semibold">Navigation Board</span>
        </div>

        <nav className="flex flex-col mt-4">

          {/* 🔵 DASHBOARD */}
          {isDashboard && (
            <>
              {(() => {
                const allowed = can("users.create");
                return (
                  <button
                    disabled={!allowed}
                    onClick={() => allowed && handleNavigate("/users/create")}
                    className={`${baseBtn} ${!allowed ? disabledStyle : ""}`}
                  >
                    <UserPlus size={20} />
                    <span className="text-lg">Crear Usuario</span>
                  </button>
                );
              })()}

              {(() => {
                const allowed = can("users.read");
                return (
                  <button
                    disabled={!allowed}
                    onClick={() => allowed && handleNavigate("/users")}
                    className={`${baseBtn} ${!allowed ? disabledStyle : ""}`}
                  >
                    <List size={20} />
                    <span className="text-lg">Ver Usuarios</span>
                  </button>
                );
              })()}
            </>
          )}

          {/* 🟡 MÓDULO PRINCIPAL */}
          {isMainModule && !isDashboard && (
            <button
              onClick={() => handleNavigate("/dashboard")}
              className={baseBtn}
            >
              <ArrowLeft size={20} />
              <span className="text-lg">Dashboard</span>
            </button>
          )}

          {/* 🟢 SUBMÓDULOS */}
          {!isDashboard && !isMainModule && (
            <>
              <button
                onClick={() => handleNavigate("/dashboard")}
                className={baseBtn}
              >
                <ArrowLeft size={20} />
                <span className="text-lg">Dashboard</span>
              </button>

              {parentModule && (
                <button
                  onClick={() => handleNavigate(parentModule)}
                  className={baseBtn}
                >
                  <Folder size={20} />
                  <span className="text-lg">Volver al módulo</span>
                </button>
              )}
            </>
          )}
        </nav>

        {/* IMAGEN DINÁMICA */}
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