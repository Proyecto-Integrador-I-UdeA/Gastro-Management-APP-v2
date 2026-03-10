// src/components/Header.tsx
import { useEffect, useState } from 'react';

export default function Header() {
  const [currentDateTime, setCurrentDateTime] = useState('');

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

  return (
    <header className="bg-[#001F3F] text-white p-4 flex items-center justify-between shadow-md">
      <div className="flex items-center space-x-4">
        {/* Logo placeholder */}
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
          <span className="text-xl font-bold text-[#001F3F]">G</span>
        </div>
        <div>
          <h1 className="text-xl font-bold">Gastronomic Management App</h1>
          <p className="text-sm opacity-80">Precisión culinaria, rentabilidad garantizada</p>
        </div>
      </div>

      {/* Fecha y hora actual */}
      <div className="text-sm">
        {currentDateTime || 'Cargando fecha...'}
      </div>
    </header>
  );
}