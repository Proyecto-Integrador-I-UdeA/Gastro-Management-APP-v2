'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Button from './Button'; // ajusta la ruta si es necesario
import Input from './Input';

export default function Header() {
  const [currentDateTime, setCurrentDateTime] = useState('');
  const [userName, setUserName] = useState('Cargando...');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [error, setError] = useState('');
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

  // Obtener nombre del usuario desde el token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.newPassword !== formData.confirmNewPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (formData.newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }

    try {
      const token = localStorage.getItem('token');
        console.log("TOKEN:", token);
      const response = await fetch('https://gastro-management-app-production-6187.up.railway.app/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      }
    );

      const text = await response.text();
      console.log("RESPUESTA BACKEND:",text);

      if (!response.ok) {
        throw new Error(text || 'Error al cambiar la contraseña');
      }

      alert('Contraseña actualizada con éxito. Inicia sesión nuevamente.');
      setShowPasswordModal(false);
      handleLogout(); // Logout automático
    } catch (err: any) {
      setError(err.message || 'Error al cambiar la contraseña');
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

      {/* Fecha/hora + Nombre + Botones */}
      <div className="flex flex-col items-end space-y-2">
        {/* Fecha y hora */}
        <div className="text-sm opacity-90">
          {currentDateTime || 'Cargando fecha...'}
        </div>

        {/* Nombre del usuario logueado */}
        <div className="text-base font-semibold text-white/95">
          {userName}
        </div>
{/* Botones */}
{userName !== 'No autenticado' && userName !== 'Cargando...' && (
  <div className="flex flex-col items-end space-y-2">
    
    <Button
      variant="danger"
      onClick={handleLogout}
      className="text-sm px-4 py-2"
    >
      Cerrar Sesión
    </Button>

    <button
      onClick={() => setShowPasswordModal(true)}
      className="text-xs text-blue-300 hover:text-blue-400 underline"
    >
      Cambiar mi contraseña
    </button>

  </div>
)}
</div>
      {/* Modal para cambiar contraseña */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full">
            <h2 className="text-2xl font-bold text-[#001F3F] mb-6">Cambiar mi contraseña</h2>

            {error && <p className="text-red-600 mb-4">{error}</p>}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <Input
                label="Contraseña actual"
                type="password"
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                required
              />
              <Input
                label="Nueva contraseña"
                type="password"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                required
              />
              <Input
                label="Confirmar nueva contraseña"
                type="password"
                name="confirmNewPassword"
                value={formData.confirmNewPassword}
                onChange={handleChange}
                required
              />

              <div className="flex justify-end space-x-4 mt-6">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setError('');
                    setFormData({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit">Guardar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
    );
}