import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import { getUserRole } from '../utils/auth';

export default function Dashboard() {
  const router = useRouter();
  const [isSuper, setIsSuper] = useState(false);  // estado inicial: false (no mostrar botón)

  useEffect(() => {
    // Esta lógica SOLO se ejecuta en el navegador (cliente)
    const role = getUserRole();
    setIsSuper(role === 'super');

    // Protección básica: redirigir si no hay token
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const handleCreateUser = () => {
    router.push('/users/create');
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <Header />
        <main className="p-8">
          <h1 className="text-3xl font-bold text-[#001F3F] mb-8">
            Bienvenido al Dashboard
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg cursor-pointer">
              <h2 className="text-xl font-semibold">Productos</h2>
              <p className="text-gray-600 mt-2">Gestiona inventario y stock</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg cursor-pointer">
              <h2 className="text-xl font-semibold">Recetas</h2>
              <p className="text-gray-600 mt-2">Estandarización y creación</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg cursor-pointer">
              <h2 className="text-xl font-semibold">Costos</h2>
              <p className="text-gray-600 mt-2">Costeo y determinación de precios</p>
            </div>
          </div>

          {/* Botón solo para superusuario */}
          {isSuper && (
            <div className="mt-10">
              <button
                onClick={handleCreateUser}
                className="bg-[#001F3F] text-white px-8 py-4 rounded-lg shadow-md hover:bg-blue-900 hover:shadow-lg transition-all duration-200 font-medium text-lg"
              >
                Registrar Nuevo Usuario
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}