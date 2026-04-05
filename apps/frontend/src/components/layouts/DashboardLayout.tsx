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
        <main className="p-8">

          <Breadcrumb />
          
          {children}
        </main>

      </div>
    </div>
  );
}