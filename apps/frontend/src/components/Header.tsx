'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from './Button';
import Input from './Input';
import Logo from './Logo';
  import { useSidebar } from '@/context/SidebarContext';


export default function Header({ showUser = true }: { showUser?: boolean }) {
  
  const { setOpen } = useSidebar(); 
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
      const formatted = now.toLocaleString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      setCurrentDateTime(formatted);
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Usuario
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserName(payload.fullName || payload.email || 'Usuario');
      } catch {
        setUserName('Usuario');
      }
    } else {
      setUserName('No autenticado');
    }
  }, []);

  const handleLogout = () => {
    if (confirm('¿Cerrar sesión?')) {
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
      setError('Mínimo 8 caracteres');
      return;
    }

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        'https://gastro-management-app-production-6187.up.railway.app/auth/change-password',
        {
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

      if (!response.ok) throw new Error(await response.text());

      alert('Contraseña actualizada');
      setShowPasswordModal(false);
      handleLogout();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <header className="bg-[#001F3F] text-white shadow-md">

      {/* 🔥 CONTENEDOR RESPONSIVE */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between p-4 gap-4">

        {/* Logo */}
        <div className="flex items-center gap-3">
          {/* 🔥 BOTÓN HAMBURGUESA */}
  <button
    onClick={() => setOpen(true)}
    className="lg:hidden text-2xl"
  >
    ☰
  </button>
          <Logo />
          <div>
            <h1 className="text-lg sm:text-xl font-bold">
              Gastronomic Management App
            </h1>
            <p className="text-xs sm:text-sm opacity-80">
              Precisión culinaria, rentabilidad garantizada
            </p>
          </div>
        </div>

        {/* Usuario */}
        {showUser && (
          <div className="flex flex-col lg:items-end gap-2 text-sm">

            <div>{currentDateTime || 'Cargando fecha...'}</div>

            <div className="font-semibold">
              {userName}
            </div>

            {userName !== 'No autenticado' && userName !== 'Cargando...' && (
              <div className="flex flex-col sm:flex-row gap-2">

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
                  Cambiar contraseña
                </button>

              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-md mx-4">

            <h2 className="text-xl font-bold text-[#001F3F] mb-4">
              Cambiar contraseña
            </h2>

            {error && <p className="text-red-600 mb-4">{error}</p>}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <Input label="Actual" type="password" name="currentPassword" value={formData.currentPassword} onChange={handleChange} required />
              <Input label="Nueva" type="password" name="newPassword" value={formData.newPassword} onChange={handleChange} required />
              <Input label="Confirmar" type="password" name="confirmNewPassword" value={formData.confirmNewPassword} onChange={handleChange} required />

              <div className="flex justify-end gap-3 mt-4">
                <Button type="button" variant="secondary" onClick={() => setShowPasswordModal(false)}>
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