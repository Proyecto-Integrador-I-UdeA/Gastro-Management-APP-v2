"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Button from "@/components/Button";
import { getUserRole } from "@/utils/auth";
import { showError } from "@/utils/toast";
import { ROUTES } from "@/constants/routes";

export default function Dashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);

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

  // ✅ FUNCIÓN CORRECTA
  const can = (permission: string) => {
    return permissions.includes(permission);
  };

  const handleNavigate = (path: string, permission?: string) => {
    if (permission && !can(permission)) {
      showError("No cuentas con los permisos para ingresar a este módulo");
      return;
    }

    router.push(path);
  };

  // 🎨 estilos
  const baseCard = `
    bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
    shadow-[0_4px_20px_rgba(30,64,175,0.25)]
    transition-all duration-300 flex flex-col
  `;

  const activeCard = `
    hover:scale-110 hover:-translate-y-2
    hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
    cursor-pointer
  `;

  const disabledCard = `
    opacity-30 cursor-not-allowed pointer-events-none
  `;

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
            {/* (se mantienen comentados como pediste) */}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

              {/* PRODUCTOS */}
              {(() => {
                const allowed = can("products.read");
                return (
                  <div
                    onClick={() => allowed && handleNavigate("/products")}
                    className={`${baseCard} ${allowed ? activeCard : disabledCard}`}
                  >
                    <h2>PRODUCTOS</h2>
                    <p>Gestiona stocks y categorías</p>
                  </div>
                );
              })()}

              {/* PROVEEDORES */}
              {(() => {
                const allowed = can("suppliers.read");
                return (
                  <div
                    onClick={() => allowed && handleNavigate("/suppliers")}
                    className={`${baseCard} ${allowed ? activeCard : disabledCard}`}
                  >
                    <h2>PROVEEDORES</h2>
                    <p>Directorio y Datos de tus Aliados</p>
                  </div>
                );
              })()}

              {/* PRODUCCIÓN */}
              {(() => {
                const allowed = can("recipes.read");
                return (
                  <div
                    onClick={() => allowed && handleNavigate("/production")}
                    className={`${baseCard} ${allowed ? activeCard : disabledCard}`}
                  >
                    <h2>PRODUCCIÓN</h2>
                    <p>Estandariza tus platos</p>
                  </div>
                );
              })()}

              {/* COSTOS */}
              {(() => {
                const allowed = can("costs.read");
                return (
                  <div
                    onClick={() => allowed && handleNavigate("/costs")}
                    className={`${baseCard} ${allowed ? activeCard : disabledCard}`}
                  >
                    <h2>COSTOS</h2>
                    <p>Costos y precios</p>
                  </div>
                );
              })()}

              {/* TRASLADOS */}
              {(() => {
                const allowed = can("transfers.read");
                return (
                  <div
                    onClick={() => allowed && handleNavigate("/transfers")}
                    className={`${baseCard} ${allowed ? activeCard : disabledCard}`}
                  >
                    <h2>TRASLADOS</h2>
                    <p>Registra Entradas y Salidas</p>
                  </div>
                );
              })()}

              {/* INVENTARIO */}
              {(() => {
                const allowed = can("inventory.read");
                return (
                  <div
                    onClick={() => allowed && handleNavigate("/inventory")}
                    className={`${baseCard} ${allowed ? activeCard : disabledCard}`}
                  >
                    <h2>INVENTARIOS</h2>
                    <p>Consulta existencias</p>
                  </div>
                );
              })()}

              {/* CONTABILIDAD */}
              {(() => {
                const allowed = can("accounting.read");
                return (
                  <div
                    onClick={() => allowed && handleNavigate("/accounting")}
                    className={`${baseCard} ${allowed ? activeCard : disabledCard}`}
                  >
                    <h2>CONTABILIDAD</h2>
                    <p>Registra tu Actividad Contable</p>
                  </div>
                );
              })()}

              {/* VENTAS */}
              {(() => {
                const allowed = can("sales.read");
                return (
                  <div
                    onClick={() => allowed && handleNavigate("/sales")}
                    className={`${baseCard} ${allowed ? activeCard : disabledCard}`}
                  >
                    <h2>VENTAS</h2>
                    <p>Gestión de ventas</p>
                  </div>
                );
              })()}

              {/* REPORTES */}
              {(() => {
                const allowed = can("reports.read");
                return (
                  <div
                    onClick={() =>
                      allowed && handleNavigate(ROUTES.reports.productsInventory)
                    }
                    className={`${baseCard} ${allowed ? activeCard : disabledCard}`}
                  >
                    <h2>REPORTES</h2>
                    <p>Accede a reportes</p>
                  </div>
                );
              })()}

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}




























































































































































