import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../components/Header';
import Button from '../components/Button';
import { getUserRole } from '../utils/auth';
import { ROUTES } from '../constants/routes';
import Sidebar from '../components/Sidebar';

export default function Dashboard() {
  const router = useRouter();
  const [isSuper, setIsSuper] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const role = getUserRole();

    // 🔥 ajusta según tu lógica real
    setIsSuper(role === 'super' || role === 1);
    setIsAdmin(role === 'admin' || role === 2);
  }, []);

  const handleCreateUser = () => {
    router.push('/users/create');
  };

  const handleViewUsers = () => {
    router.push('/users');
  };

  return (
    <div className="flex min-h-screen relative z-0">
         <Sidebar /> 

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 lg:ml-72 bg-white rounded-bl-2xl overflow-hidden">

        <Header />

        <main className="p-4 sm:p-6 lg:p-8">
          <div className="bg-white rounded-tl-2xl shadow-md p-6 min-h-screen">

            <h1 className="text-2xl sm:text-3xl font-bold text-[#001F3F] mb-4">
              Dashboard Principal
            </h1>

            {/* BOTONES */}
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

            <div
            onClick={() => router.push(ROUTES.products.list)}
            className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
            shadow-[0_4px_20px_rgba(30,64,175,0.25)]
            hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
            hover:-translate-y-1
            transition-all duration-300 cursor-pointer flex flex-col"
       >
            <h2 className="text-lg font-semibold text-gray-800 mb-2">PRODUCTOS</h2>
             <p className="text-sm text-gray-600">Gestiona stocks y categorías</p>
</div>
              
                          <div
            onClick={() => router.push(ROUTES.products.list)}
            className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
            shadow-[0_4px_20px_rgba(30,64,175,0.25)]
            hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
            hover:-translate-y-1
            transition-all duration-300 cursor-pointer flex flex-col"
       >
            <h2 className="text-lg font-semibold text-gray-800 mb-2">PROVEEDORES</h2>
             <p className="text-sm text-gray-600">Directorio y Datos de tus Aliados</p>
</div>
          
                      <div
            onClick={() => router.push(ROUTES.products.list)}
            className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
            shadow-[0_4px_20px_rgba(30,64,175,0.25)]
            hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
            hover:-translate-y-1
            transition-all duration-300 cursor-pointer flex flex-col"
       >
            <h2 className="text-lg font-semibold text-gray-800 mb-2">TRASLADOS</h2>
             <p className="text-sm text-gray-600">Registra Entradas y Salidas de Productos</p>
</div>
        
                    <div
            onClick={() => router.push(ROUTES.products.list)}
            className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
            shadow-[0_4px_20px_rgba(30,64,175,0.25)]
            hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
            hover:-translate-y-1
            transition-all duration-300 cursor-pointer flex flex-col"
       >
            <h2 className="text-lg font-semibold text-gray-800 mb-2">INVENTARIOS</h2>
             <p className="text-sm text-gray-600">Consulta tus Existencias en Tiempo Real</p>
</div>
              
                          <div
            onClick={() => router.push(ROUTES.products.list)}
            className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
            shadow-[0_4px_20px_rgba(30,64,175,0.25)]
            hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
            hover:-translate-y-1
            transition-all duration-300 cursor-pointer flex flex-col"
       >
            <h2 className="text-lg font-semibold text-gray-800 mb-2">PRODUCCION</h2>
             <p className="text-sm text-gray-600">Crea y Estandarizatus Platos </p>
</div>

                        <div
            onClick={() => router.push(ROUTES.products.list)}
            className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
            shadow-[0_4px_20px_rgba(30,64,175,0.25)]
            hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
            hover:-translate-y-1
            transition-all duration-300 cursor-pointer flex flex-col"
       >
            <h2 className="text-lg font-semibold text-gray-800 mb-2">MENÚ</h2>
             <p className="text-sm text-gray-600">Consulta todo tu Menú Estandarizado</p>
</div>
         <div
            onClick={() => router.push(ROUTES.products.list)}
            className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
            shadow-[0_4px_20px_rgba(30,64,175,0.25)]
            hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
            hover:-translate-y-1
            transition-all duration-300 cursor-pointer flex flex-col"
       >
            <h2 className="text-lg font-semibold text-gray-800 mb-2">COSTOS</h2>
             <p className="text-sm text-gray-600">Determina el Costo y el Precio de Venta</p>
</div>
            <div
            onClick={() => router.push(ROUTES.products.list)}
            className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
            shadow-[0_4px_20px_rgba(30,64,175,0.25)]
            hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
            hover:-translate-y-1
            transition-all duration-300 cursor-pointer flex flex-col"
       >
            <h2 className="text-lg font-semibold text-gray-800 mb-2">VENTAS</h2>
             <p className="text-sm text-gray-600">Gestiona y Consulta todas tus Ventas</p>
</div>
           
                       <div
            onClick={() => router.push(ROUTES.products.list)}
            className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
            shadow-[0_4px_20px_rgba(30,64,175,0.25)]
            hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
            hover:-translate-y-1
            transition-all duration-300 cursor-pointer flex flex-col"
       >
            <h2 className="text-lg font-semibold text-gray-800 mb-2">REPORTES</h2>
             <p className="text-sm text-gray-600">Accede a todos los Reportes de cada Modulo</p>
</div>
          

            </div>

          </div>
        </main>

      </div>
    </div>
  );
}