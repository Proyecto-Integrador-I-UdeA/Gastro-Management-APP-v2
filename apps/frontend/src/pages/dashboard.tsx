import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import { isSuperUser, getUserRole } from '../utils/auth';
import { ROUTES } from '../constants/routes';

export default function Dashboard() {
  const router = useRouter();
  const [isSuper, setIsSuper] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); // nuevo estado para admin

  useEffect(() => {
    const role = getUserRole(); // usamos getUserRole() que ya tienes
    setIsSuper(role === 'super');
    setIsAdmin(role === 'admin');

    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const handleCreateUser = () => {
    router.push('/users/create');
  };

  const handleViewUsers = () => {
    router.push('/users');
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar izquierdo con imagen elegante y botones (solo super y admin) */}
      <div className="w-80 bg-[#001F3F] hidden lg:block fixed h-full overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Imagen elegante ocupando todo el espacio superior */}
          <div className="flex-1 bg-cover bg-center"
               style={{ backgroundImage: "url('https://images.unsplash.com/photo-1517248135467-4c7edcad34b4?ixlib=rb-4.0.3&auto=format&fit=crop&q=80')" }}>
          </div>

          {/* Botones en la parte inferior */}
          <div className="p-6 bg-[#001F3F]/90 border-t border-white/10 flex flex-col space-y-4">
            {/* Botón Registrar Nuevo Usuario - solo super */}
            {isSuper && (
              <button
                onClick={handleCreateUser}
                className="w-full bg-gray-100 text-gray-800 py-3 rounded-lg shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-200 font-medium text-base border border-blue-200"
              >
                Registrar Nuevo Usuario
              </button>
            )}

            {/* Botón Ver Listado de Usuarios - solo super y admin */}
            {(isSuper || isAdmin) && (
              <button
                onClick={handleViewUsers}
                className="w-full bg-gray-100 text-gray-800 py-3 rounded-lg shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-200 font-medium text-base border border-blue-200"
              >
                Ver Listado de Usuarios
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 lg:ml-80">
        <Header />
        <main className="p-8">
          <h1 className="text-3xl font-bold text-[#001F3F] mb-8">
            Bienvenido al Dashboard
          </h1>

          {/* Grid de 6 botones grandes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {/* Productos */}
            <div 
              onClick={() => router.push(ROUTES.products.list)}
              className="bg-gray-200 p-8 rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border-2 border-blue-300 flex flex-col justify-between"
            >
              <h2 className="text-2xl font-semibold text-gray-800 mb-3">Productos</h2>
              <p className="text-gray-600">Gestiona inventario y stock</p>
            </div>

            {/* Proveedores */}
            <div 
              onClick={() => router.push(ROUTES.suppliers.list)}
              className="bg-gray-200 p-8 rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border-2 border-blue-300 flex flex-col justify-between"
            >
              <h2 className="text-2xl font-semibold text-gray-800 mb-3">Proveedores</h2>
              <p className="text-gray-600">Directorio y datos de contacto</p>
            </div>

            {/* Recetas */}
            <div 
              onClick={() => router.push('/recipes')}
              className="bg-gray-200 p-8 rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border-2 border-blue-300 flex flex-col justify-between"
            >
              <h2 className="text-2xl font-semibold text-gray-800 mb-3">Recetas</h2>
              <p className="text-gray-600">Estandarización y creación</p>
            </div>

            {/* Costos */}
            <div 
              onClick={() => router.push('/costs')}
              className="bg-gray-200 p-8 rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border-2 border-blue-300 flex flex-col justify-between"
            >
              <h2 className="text-2xl font-semibold text-gray-800 mb-3">Costos</h2>
              <p className="text-gray-600">Costeo y determinación de precios</p>
            </div>

            {/* Ventas */}
            <div 
              onClick={() => router.push('/ventas')}
              className="bg-gray-200 p-8 rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border-2 border-blue-300 flex flex-col justify-between"
            >
              <h2 className="text-2xl font-semibold text-gray-800 mb-3">Ventas</h2>
              <p className="text-gray-600">Consulta el registro de ventas</p>
            </div>

            {/* Menú */}
            <div 
              onClick={() => router.push('/menu')}
              className="bg-gray-200 p-8 rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border-2 border-blue-300 flex flex-col justify-between"
            >
              <h2 className="text-2xl font-semibold text-gray-800 mb-3">Menú</h2>
              <p className="text-gray-600">Consulta el menú completo estandarizado</p>
            </div>

            {/* Reportes */}
            <div 
              onClick={() => router.push('/reportes')}
              className="bg-gray-200 p-8 rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border-2 border-blue-300 flex flex-col justify-between"
            >
              <h2 className="text-2xl font-semibold text-gray-800 mb-3">Reportes</h2>
              <p className="text-gray-600">Accede a los diferentes reportes de cada módulo</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}