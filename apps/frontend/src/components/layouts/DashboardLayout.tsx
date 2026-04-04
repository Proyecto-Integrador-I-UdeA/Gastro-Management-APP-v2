'use client';

import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Breadcrumb from "@/components/Breadcrumb";


export default function DashboardLayout({
  
  children,
}: {
  children: React.ReactNode;
}) {
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