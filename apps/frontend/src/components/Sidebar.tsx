"use client";

import { useRouter } from "next/router";
import { useSidebar } from "@/context/SidebarContext";
import { useEffect, useState } from "react";
import { showError } from "@/utils/toast";

function readPermissionsFromToken(): string[] {
  if (globalThis.window === undefined) return [];
  const token = localStorage.getItem("token");
  if (!token) return [];
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return (payload.permissions || []).map((p: string) => p.trim().toLowerCase());
  } catch {
    return [];
  }
}

function sidebarImageSrc(safePath: string): string {
  if (safePath.includes("/transfers/warehouses")) return "/images/sidebar-dashboard.jpg";
  if (safePath.includes("/suppliers/create")) return "/images/sidebar-proveedores-create.jpg";
  if (safePath.includes("/suppliers/edit")) return "/images/sidebar-proveedores-edit.jpg";
  if (safePath.includes("/suppliers")) return "/images/sidebar-proveedores.jpg";
  if (safePath.includes("/products/create")) return "/images/sidebar-productos-create.jpg";
  if (safePath.includes("/products/edit")) return "/images/sidebar-productos-edit.jpg";
  if (safePath.includes("/products")) return "/images/sidebar-productos.jpg";
  if (safePath.includes("/transfers")) return "/images/sidebar-dashboard.jpg";
  if (safePath.includes("/users/create")) return "/images/sidebar-users-create.jpg";
  if (safePath.includes("/users/edit")) return "/images/sidebar-users-edit.jpg";
  if (safePath.includes("/users")) return "/images/sidebar-users.jpg";
  if (safePath.includes("/dashboard")) return "/images/sidebar-dashboard.jpg";
  return "/images/sidebar-dashboard.jpg";
}

export default function Sidebar() {
  const router = useRouter();
  const sidebar = useSidebar();
  if (!sidebar) return null;

  const { open, setOpen } = sidebar;

  /** Evita mismatch SSR/cliente: el primer paint debe coincidir con el HTML del servidor. */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);

  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    setPermissions(readPermissionsFromToken());
  }, [router.asPath]);

  const safePath =
    hydrated && router.isReady ? (router.asPath || "").split("?")[0] : "";
  const showNav = hydrated && router.isReady;

  const isDashboardOrUsers =
    safePath === "/dashboard" || safePath.startsWith("/users");
  const inProductsModule =
    safePath.startsWith("/products") || safePath.startsWith("/suppliers");
  const inTransfersModule = safePath.startsWith("/transfers");

  const can = (perm: string) =>
    permissions.includes(perm.trim().toLowerCase());

  const canAny = (perms: string[]) =>
    perms.some((p) => permissions.includes(p.trim().toLowerCase()));

  const handleNavigate = (path: string, permission?: string) => {
    if (permission && !can(permission)) {
      showError("No tienes permiso para acceder a esta sección");
      return;
    }
    void router.push(path);
    setOpen(false);
  };

  const handleNavigateAny = (path: string, requiredAny: string[]) => {
    if (!canAny(requiredAny)) {
      showError("No tienes permiso para acceder a esta sección");
      return;
    }
    void router.push(path);
    setOpen(false);
  };

  const itemClass = (active: boolean) =>
    `flex items-center gap-4 px-6 py-4 text-left w-full hover:bg-[#33566E] ${
      active ? "bg-[#33566E]/90" : ""
    }`;

  const transfersSubActive =
    safePath === "/transfers" ||
    safePath.startsWith("/transfers/create") ||
    safePath.startsWith("/transfers/edit");
  const warehousesSubActive = safePath.startsWith("/transfers/warehouses");

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
        <div className="h-24 flex items-center justify-center border-b border-white/10" />

        <nav className="flex flex-col mt-4">
          {!showNav ? (
            <div className="min-h-[180px] px-6" aria-hidden />
          ) : isDashboardOrUsers ? (
            <>
              <button
                type="button"
                onClick={() => handleNavigate("/users/create", "users.create")}
                className="flex items-center gap-4 px-6 py-4 hover:bg-[#33566E]"
              >
                👤 <span className="text-lg">Crear Usuario</span>
              </button>
              <button
                type="button"
                onClick={() => handleNavigate("/users", "users.read")}
                className="flex items-center gap-4 px-6 py-4 hover:bg-[#33566E]"
              >
                📋 <span className="text-lg">Ver Usuarios</span>
              </button>
            </>
          ) : inTransfersModule ? (
            <>
              <button
                type="button"
                className={itemClass(transfersSubActive)}
                onClick={() => handleNavigate("/transfers", "transfers.read")}
              >
                <span className="text-xl">↔️</span>
                <span className="text-lg">Traslados</span>
              </button>
              <button
                type="button"
                className={itemClass(warehousesSubActive)}
                onClick={() =>
                  handleNavigateAny("/transfers/warehouses", [
                    "transfers.read",
                    "warehouses.read",
                  ])
                }
              >
                <span className="text-xl">🏭</span>
                <span className="text-lg">Bodegas</span>
              </button>
              <button
                type="button"
                className="flex items-center gap-4 px-6 py-4 text-left w-full hover:bg-[#33566E] text-white/80"
                onClick={() => handleNavigate("/dashboard")}
              >
                📈 <span className="text-lg">Dashboard</span>
              </button>
            </>
          ) : inProductsModule ? (
            <>
              {can("products.read") && (
                <button
                  type="button"
                  className={itemClass(safePath.startsWith("/products"))}
                  onClick={() => handleNavigate("/products", "products.read")}
                >
                  <span className="text-xl">📦</span>
                  <span className="text-lg">Productos</span>
                </button>
              )}
              {can("suppliers.read") && (
                <button
                  type="button"
                  className={itemClass(safePath.startsWith("/suppliers"))}
                  onClick={() => handleNavigate("/suppliers", "suppliers.read")}
                >
                  <span className="text-xl">🚚</span>
                  <span className="text-lg">Proveedores</span>
                </button>
              )}
              <button
                type="button"
                className="flex items-center gap-4 px-6 py-4 text-left w-full hover:bg-[#33566E] text-white/80"
                onClick={() => handleNavigate("/dashboard")}
              >
                📈 <span className="text-lg">Dashboard</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="flex items-center gap-4 px-6 py-4 text-left w-full hover:bg-[#33566E]"
              onClick={() => handleNavigate("/dashboard")}
            >
              📈 <span className="text-lg">Dashboard</span>
            </button>
          )}
        </nav>

        <div className="mt-auto p-4">
          {showNav ? (
            <img
              src={sidebarImageSrc(safePath)}
              alt="Gestión"
              className="w-full h-60 object-cover shadow-md border border-white/10 rounded-lg"
            />
          ) : (
            <div
              className="w-full h-60 rounded-lg border border-white/10 bg-white/5"
              aria-hidden
            />
          )}
        </div>
      </aside>
    </>
  );
}
