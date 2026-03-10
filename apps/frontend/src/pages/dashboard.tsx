import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

export default function Dashboard() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <Header />
        <main className="p-8">
          <h1 className="text-3xl font-bold text-[#001F3F] mb-8">Bienvenido al Dashboard</h1>

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

          {/* Solo para superusuario */}
          <div className="mt-10">
            <button className="bg-[#001F3F] text-white px-6 py-3 rounded-md hover:bg-blue-900">
              Registrar Nuevo Usuario
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}