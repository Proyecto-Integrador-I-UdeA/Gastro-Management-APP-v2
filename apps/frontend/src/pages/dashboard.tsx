"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Button from "@/components/Button";
import { getUserRole } from "@/utils/auth"; 

export default function Dashboard() {
  const router = useRouter();

  const [isSuper, setIsSuper] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 🔥 evita render SSR
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const role = getUserRole();

    setIsSuper(role === "super" || role === 1);
    setIsAdmin(role === "admin" || role === 2);
  }, []);

  // 🔥 evita errores de build en Vercel
  if (!mounted) return null;

  const handleCreateUser = () => {
    router.push("/users/create");
  };

  const handleViewUsers = () => {
    router.push("/users");
  };

  return (
    <div className="flex min-h-screen relative z-0">
      <Sidebar />

      <div className="flex-1 lg:ml-72 bg-white rounded-bl-2xl overflow-hidden">
        <Header />

        <main className="p-4 sm:p-6 lg:p-8">
          <div className="bg-white rounded-tl-2xl shadow-md p-6 min-h-screen">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#001F3F] mb-4">
              Dashboard Principal
            </h1>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              {isSuper && (
                <Button onClick={handleCreateUser} variant="secondary">
                  Registrar Usuario
                </Button>
              )}

              {(isSuper || isAdmin) && (
                <Button onClick={handleViewUsers} variant="secondary">
                  Ver Usuarios
                </Button>
              )}
            </div>

            {/* TARJETAS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              
              <div onClick={() => router.push("/products")} className="card">
                <h2>PRODUCTOS</h2>
                <p>Gestiona stocks y categorías</p>
              </div>

              <div onClick={() => router.push("/suppliers")} className="card">
                <h2>PROVEEDORES</h2>
                <p>Directorio y Datos de tus Aliados</p>
              </div>

              <div onClick={() => router.push("/transfers")} className="card">
                <h2>TRASLADOS</h2>
                <p>Registra Entradas y Salidas de Productos</p>
              </div>

              <div onClick={() => router.push("/inventory")} className="card">
                <h2>INVENTARIOS</h2>
                <p>Consulta tus Existencias en Tiempo Real</p>
              </div>

              <div onClick={() => router.push("/production")} className="card">
                <h2>PRODUCCIÓN</h2>
                <p>Crea y estandariza tus platos</p>
              </div>

              <div onClick={() => router.push("/menu")} className="card">
                <h2>MENÚ</h2>
                <p>Consulta tu menú estandarizado</p>
              </div>

              <div onClick={() => router.push("/costs")} className="card">
                <h2>COSTOS</h2>
                <p>Determina costos y precios</p>
              </div>

              <div onClick={() => router.push("/sales")} className="card">
                <h2>VENTAS</h2>
                <p>Gestiona tus ventas</p>
              </div>

              <div onClick={() => router.push("/reports")} className="card">
                <h2>REPORTES</h2>
                <p>Accede a reportes del sistema</p>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}




































































































































































