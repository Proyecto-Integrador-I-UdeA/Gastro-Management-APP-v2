// src/components/Header.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Button from './Button'; // ajusta la ruta si es necesario (ej: '../components/Button')

export default function Header() {
  const [currentDateTime, setCurrentDateTime] = useState('');
  const router = useRouter();

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      };
      const formatted = now.toLocaleString('es-CO', options);
      setCurrentDateTime(formatted);
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 60000); // actualiza cada minuto

    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    // Opcional: confirmación antes de cerrar
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
      localStorage.removeItem('token');
      router.push('/login');
    }
  };

  return (
    <header className="bg-[#001F3F] text-white p-4 flex items-center justify-between shadow-md">
      <div className="flex items-center space-x-4">
        {/* Logo y título */}
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
          <span className="text-xl font-bold text-[#001F3F]">G</span>
        </div>
        <div>
          <h1 className="text-xl font-bold">Gastronomic Management App</h1>
          <p className="text-sm opacity-80">Precisión culinaria, rentabilidad garantizada</p>
        </div>
      </div>

      {/* Fecha/hora + botón de logout */}
      <div className="flex items-center space-x-6">
        {/* Fecha y hora actual */}
        <div className="text-sm">
          {currentDateTime || 'Cargando fecha...'}
        </div>

        {/* Botón Cerrar Sesión usando tu componente Button */}
        <Button
          variant="danger"          // rojo para destacar que es acción de cierre
          onClick={handleLogout}
        >
          Cerrar Sesión
        </Button>
      </div>
    </header>
  );
}