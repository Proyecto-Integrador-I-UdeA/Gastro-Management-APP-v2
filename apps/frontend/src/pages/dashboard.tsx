import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../components/Header';
import Button from '../components/Button';
import { getUserRole } from '../utils/auth';
import { ROUTES } from '../constants/routes';

export default function Dashboard() {
  const router = useRouter();
  const [isSuper, setIsSuper] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const role = getUserRole();
    //setIsSuper(role === 'super');
    //setIsAdmin(role === 'admin');
    setIsSuper(true);
    setIsAdmin(true);
  }, []);

  const handleCreateUser = () => {
    router.push('/users/create');
  };

  const handleViewUsers = () => {
    router.push('/users');
  };

  return (
    <div className="flex min-h-screen">

      {/* Sidebar personalizado SOLO dashboard */}
      <div className="w-72 bg-[#001F3F] hidden lg:flex fixed h-full flex-col justify-between">

        {/* Imagen elegante */}
        <div
          className="flex-1 bg-cover bg-center brightness-75"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1000&q=80')",
          }}
        />

        {/* Botones abajo */}
        <div className="p-6 bg-[#001F3F]/90 border-t border-white/10 flex flex-col space-y-4">

          {isSuper && (
            <Button
              onClick={handleCreateUser}
              variant="secondary"
              className="w-full py-3 shadow-lg hover:-translate-y-1"
            >
              Registrar Nuevo Usuario
            </Button>
          )}

          {(isSuper || isAdmin) && (
            <Button
              onClick={handleViewUsers}
              variant="secondary"
              className="w-full py-3 shadow-lg hover:-translate-y-1"
            >
              Ver Listado de Usuarios
            </Button>
          )}

        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 ml-72 bg-white rounded-bl-2xl overflow-hidden">
        <Header />

        <main className="p-8">
          <div className="bg-white rounded-tl-2xl shadow-md p-6 min-h-screen">

            <h1 className="text-3xl font-bold text-[#001F3F] mb-2">
              Dashboard Principal
            </h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

              {/* TARJETAS */}

              <div onClick={() => router.push(ROUTES.products.list)}
                className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
                shadow-[0_4px_20px_rgba(30,64,175,0.25)]
                hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
                transition-all duration-300 cursor-pointer flex flex-col">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">PRODUCTOS</h2>
                <p className="text-sm text-gray-600">Gestiona stocks y categorías</p>
              </div>

              <div onClick={() => router.push(ROUTES.suppliers.list)}
                className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
                shadow-[0_4px_20px_rgba(30,64,175,0.25)]
                hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
                transition-all duration-300 cursor-pointer flex flex-col">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">PROVEEDORES</h2>
                <p className="text-sm text-gray-600">Directorio y datos de tus aliados</p>
              </div>

              <div onClick={() => router.push('/traslados')}
                className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
                shadow-[0_4px_20px_rgba(30,64,175,0.25)]
                hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
                transition-all duration-300 cursor-pointer flex flex-col">
                <h2 className="text-base font-semibold text-gray-800 mb-2">TRASLADOS</h2>
                <p className="text-sm text-gray-600">Registra las entradas y salidas de productos</p>
              </div>

              <div onClick={() => router.push('/inventario')}
                className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
                shadow-[0_4px_20px_rgba(30,64,175,0.25)]
                hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
                transition-all duration-300 cursor-pointer flex flex-col">
                <h2 className="text-base font-semibold text-gray-800 mb-2">INVENTARIO</h2>
                <p className="text-sm text-gray-600">Conoce tus existencias en tiempo real</p>
              </div>

              <div onClick={() => router.push('/recipes')}
                className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
                shadow-[0_4px_20px_rgba(30,64,175,0.25)]
                hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
                transition-all duration-300 cursor-pointer flex flex-col">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">PRODUCCIÓN</h2>
                <p className="text-sm text-gray-600">Creación y estandarización de platos</p>
              </div>

              <div onClick={() => router.push('/menu')}
                className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
                shadow-[0_4px_20px_rgba(30,64,175,0.25)]
                hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
                transition-all duration-300 cursor-pointer flex flex-col">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">MENÚ</h2>
                <p className="text-sm text-gray-600">Consulta tu menú completo estandarizado</p>
              </div>

              <div onClick={() => router.push('/costs')}
                className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
                shadow-[0_4px_20px_rgba(30,64,175,0.25)]
                hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
                transition-all duration-300 cursor-pointer flex flex-col">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">COSTOS</h2>
                <p className="text-sm text-gray-600">Determina el costo y precio de venta</p>
              </div>

              <div onClick={() => router.push('/ventas')}
                className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
                shadow-[0_4px_20px_rgba(30,64,175,0.25)]
                hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
                transition-all duration-300 cursor-pointer flex flex-col">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">VENTAS</h2>
                <p className="text-sm text-gray-600">Consulta el registro de ventas</p>
              </div>

              <div onClick={() => router.push('/reportes')}
                className="bg-gray-400/20 backdrop-blur-md p-4 rounded-xl border border-white/20
                shadow-[0_4px_20px_rgba(30,64,175,0.25)]
                hover:shadow-[0_6px_25px_rgba(30,64,175,0.35)]
                transition-all duration-300 cursor-pointer flex flex-col">
                <h2 className="text-lg font-semibold text-gray-800 mb-2">REPORTES</h2>
                <p className="text-sm text-gray-600">Accede a los reportes de cada módulo</p>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}