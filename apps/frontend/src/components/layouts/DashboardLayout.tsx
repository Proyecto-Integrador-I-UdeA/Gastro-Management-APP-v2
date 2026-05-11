'use client';

import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Breadcrumb from "@/components/Breadcrumb";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token || token === "null") {
      router.push("/login");
      setIsAuthenticated(false);
    } else {
      setIsAuthenticated(true);
    }
  }, []);

  // 🔥 DETECTAR RUTA ACTUAL
  const path = router.pathname;

  let parentRoute: string | null = null;
  let parentLabel: string | null = null;

  if (path.startsWith("/products") && path !== "/products") {
    parentRoute = "/products";
    parentLabel = "Productos";
  }

  if (path.startsWith("/recipes") && path !== "/production") {
    parentRoute = "/production";
    parentLabel = "Produccion";
  }
   if (path.startsWith("/menu") && path !== "/production") {
   parentRoute = "/production";
   parentLabel = "Produccion";
 }

  if (path.startsWith("/suppliers") && path !== "/suppliers") {
    parentRoute = "/suppliers";
    parentLabel = "Proveedores";
  }
   if (path.startsWith("/costs") && path !== "/costs") {
   parentRoute = "/costs";
   parentLabel = "Costos";
 }
  if (path.startsWith("/inventory") && path !== "/inventory") {
   parentRoute = "/inventory";
   parentLabel = "Inventarios";
 }
  if (path.startsWith("/transfers") && path !== "/transfers") {
   parentRoute = "/transfers";
   parentLabel = "Traslados";
 }
  if (path.startsWith("/accounting") && path !== "/accounting") {
   parentRoute = "/accounting";
   parentLabel = "Contabilidad";
 }
  if (path.startsWith("/sales") && path !== "/sales") {
   parentRoute = "/sales";
   parentLabel = "Ventas";
 }
  if (path.startsWith("/reports") && path !== "/reports") {
   parentRoute = "/reports";
   parentLabel = "Reportes";
 }

  if (isAuthenticated === null) {
    return <div className="p-10 text-center">Cargando...</div>;
  }

  return (
    <div className="flex min-h-screen bg-gray-100">

      {/* Sidebar */}
      <Sidebar />

      {/* Contenido */}
      <div className="flex-1 ml-72">

        {/* Header */}
        <Header />

        {/* Contenido dinámico */}
        <main className="p-4">

          <Breadcrumb />

          {/* 🔥 BOTÓN VOLVER */}
          {parentRoute && (
            <button
              onClick={() => router.push(parentRoute)}
              className="mb-4 text-sm text-blue-600 hover:underline"
            >
              ← Volver a {parentLabel}
            </button>
          )}

          {children}
        </main>

      </div>
    </div>
  );
}