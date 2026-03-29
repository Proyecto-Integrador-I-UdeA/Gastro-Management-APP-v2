"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Button from "@/components/Button";
import { getUserRole } from "@/utils/auth";

export default function Dashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);

  // 🔥 evitar SSR
  useEffect(() => {
    setMounted(true);

    if (typeof window !== "undefined") {
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

  if (!mounted) return null;

  // 🔥 helper permisos
  const can = (perm: string) => {
  if (typeof window === "undefined") return false;

  const token = localStorage.getItem("token");
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.permissions?.includes(perm);
  } catch {
    return false;
  }
};

  // 🔥 navegación con control
  const handleNavigate = (path: string, permission: string) => {
    if (!can(permission)) {
      alert("No cuentas con los permisos para ingresar a este modulo");
      return;
    }
    router.push(path);
  };

  return (
    <div className="flex min-h-screen relative z-0">
      <Sidebar />

      <div className="flex-1 lg:ml-72 bg-white rounded-bl-2xl overflow-hidden">
        <Header />

        <main className="p-4 sm:p-6 lg:p-8">
          <div className="bg-white rounded-tl-2xl shadow-md p-6 min-h-screen">

            <h1 className="text-2xl sm:text-3xl font-bold text-[#001F3F] mb-6">
              Dashboard Principal
            </h1>

            {/* BOTONES DASHBOARD */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">

              <Button
                onClick={() => handleNavigate("/users/create", "users.create")}
                variant="secondary"
              >
                Registrar Usuario
              </Button>

              <Button
                onClick={() => handleNavigate("/users", "users.read")}
                variant="secondary"
              >
                Ver Usuarios
              </Button>

            </div>

            {/* TARJETAS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

              {/* PRODUCTOS */}
              <div
                onClick={() => handleNavigate("/products", "products.read")}
                className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
                shadow-[0_4px_20px_rgba(30,64,175,0.25)]
                hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
                transition-all duration-300 cursor-pointer flex flex-col"
              >
                <h2 className="text-lg font-semibold text-gray-800 mb-2">PRODUCTOS</h2>
                <p className="text-sm text-gray-600">Gestiona stocks y categorías</p>
              </div>

              {/* PROVEEDORES */}
              <div
                onClick={() => handleNavigate("/suppliers", "suppliers.read")}
                className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
                shadow-[0_4px_20px_rgba(30,64,175,0.25)]
                hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
                transition-all duration-300 cursor-pointer flex flex-col"
              >
                <h2 className="text-lg font-semibold text-gray-800 mb-2">PROVEEDORES</h2>
                <p className="text-sm text-gray-600">Directorio y Datos de tus Aliados</p>
              </div>

              {/* TRASLADOS */}
              <div
                onClick={() => handleNavigate("/transfers", "transfers.read")}
                className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
                shadow-[0_4px_20px_rgba(30,64,175,0.25)]
                hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
                transition-all duration-300 cursor-pointer flex flex-col"
              >
                <h2 className="text-lg font-semibold text-gray-800 mb-2">TRASLADOS</h2>
                <p className="text-sm text-gray-600">Registra Entradas y Salidas</p>
              </div>

              {/* INVENTARIO */}
              <div
                onClick={() => handleNavigate("/inventory", "inventory.read")}
                className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
                shadow-[0_4px_20px_rgba(30,64,175,0.25)]
                hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
                transition-all duration-300 cursor-pointer flex flex-col"
              >
                <h2 className="text-lg font-semibold text-gray-800 mb-2">INVENTARIOS</h2>
                <p className="text-sm text-gray-600">Consulta existencias</p>
              </div>

              {/* PRODUCCIÓN */}
              <div
                onClick={() => handleNavigate("/production", "recipes.read")}
                className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
                shadow-[0_4px_20px_rgba(30,64,175,0.25)]
                hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
                transition-all duration-300 cursor-pointer flex flex-col"
              >
                <h2 className="text-lg font-semibold text-gray-800 mb-2">PRODUCCIÓN</h2>
                <p className="text-sm text-gray-600">Estandariza tus platos</p>
              </div>

              {/* MENÚ */}
              <div
                onClick={() => handleNavigate("/menu", "recipes.read")}
                className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
                shadow-[0_4px_20px_rgba(30,64,175,0.25)]
                hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
                transition-all duration-300 cursor-pointer flex flex-col"
              >
                <h2 className="text-lg font-semibold text-gray-800 mb-2">MENÚ</h2>
                <p className="text-sm text-gray-600">Consulta tu menú</p>
              </div>

              {/* COSTOS */}
              <div
                onClick={() => handleNavigate("/costs", "costs.read")}
                className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
                shadow-[0_4px_20px_rgba(30,64,175,0.25)]
                hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
                transition-all duration-300 cursor-pointer flex flex-col"
              >
                <h2 className="text-lg font-semibold text-gray-800 mb-2">COSTOS</h2>
                <p className="text-sm text-gray-600">Costos y precios</p>
              </div>

              {/* VENTAS */}
              <div
                onClick={() => handleNavigate("/sales", "sales.read")}
                className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
                shadow-[0_4px_20px_rgba(30,64,175,0.25)]
                hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
                transition-all duration-300 cursor-pointer flex flex-col"
              >
                <h2 className="text-lg font-semibold text-gray-800 mb-2">VENTAS</h2>
                <p className="text-sm text-gray-600">Gestión de ventas</p>
              </div>

              {/* REPORTES */}
              <div
                onClick={() => handleNavigate("/reports", "reports.read")}
                className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
                shadow-[0_4px_20px_rgba(30,64,175,0.25)]
                hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
                transition-all duration-300 cursor-pointer flex flex-col"
              >
                <h2 className="text-lg font-semibold text-gray-800 mb-2">REPORTES</h2>
                <p className="text-sm text-gray-600">Accede a reportes</p>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}































































































































































