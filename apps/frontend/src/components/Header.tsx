// src/components/Header.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Button from './Button'; // ajusta la ruta si es necesario

export default function Header() {
  const [currentDateTime, setCurrentDateTime] = useState('');
  const [userName, setUserName] = useState('Cargando...'); // ← nuevo estado para el nombre
  const router = useRouter();

  // Fecha y hora
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
    const interval = setInterval(updateDateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Obtener nombre del usuario desde el token (solo en cliente)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        // Decodificar JWT sin librería externa (usando atob nativo)
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Priorizamos fullName, si no existe usamos email
        setUserName(payload.fullName || payload.email || 'Usuario');
      } catch (e) {
        console.error('Error al decodificar token para nombre:', e);
        setUserName('Usuario');
      }
    } else {
      setUserName('No autenticado');
    }
  }, []);

  const handleLogout = () => {
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

      {/* Fecha/hora + Nombre + Botón Cerrar Sesión */}
      <div className="flex flex-col items-end space-y-1">
        {/* Fecha y hora */}
        <div className="text-sm">
          {currentDateTime || 'Cargando fecha...'}
        </div>

        {/* Nombre del usuario logueado (debajo de la fecha) */}
        <div className="text-sm font-medium">
          {userName}
        </div>

        {/* Botón Cerrar Sesión */}
        <Button variant="danger" onClick={handleLogout}>
          Cerrar Sesión
        </Button>
      </div>
    </header>
  )


























































}