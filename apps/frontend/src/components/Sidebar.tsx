
export default function Sidebar() {
  return (
    <aside className="w-64 bg-[#001F3F] text-white h-screen p-6 flex flex-col space-y-6">
      <ul className="space-y-4">
        <li className="flex items-center space-x-3 hover:bg-blue-900 p-3 rounded cursor-pointer">
          <span className="text-xl">🛒</span> <span>Inventario</span>
        </li>
        <li className="flex items-center space-x-3 hover:bg-blue-900 p-3 rounded cursor-pointer">
          <span className="text-xl">📋</span> <span>Recetas</span>
        </li>
        <li className="flex items-center space-x-3 hover:bg-blue-900 p-3 rounded cursor-pointer">
          <span className="text-xl">$</span> <span>Costos</span>
        </li>
        <li className="flex items-center space-x-3 hover:bg-blue-900 p-3 rounded cursor-pointer">
          <span className="text-xl">📊</span> <span>Reportes</span>
        </li>
        <li className="flex items-center space-x-3 hover:bg-blue-900 p-3 rounded cursor-pointer">
          <span className="text-xl">⚙️</span> <span>Configuración</span>
        </li>
      </ul>
    </aside>
  );
}