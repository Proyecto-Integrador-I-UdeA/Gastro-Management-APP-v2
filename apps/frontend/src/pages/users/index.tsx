'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { api } from '../../utils/api';
import { isSuperUser } from '../../utils/auth';

interface User {
  id: number;
  email: string;
  fullName: string;
  role: { name: string };
  active: boolean;
}

export default function UsersList() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSuper, setIsSuper] = useState(false);

  useEffect(() => {
    /*const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
     */ return;
    }

    setIsSuper(isSuperUser());

    const fetchUsers = async () => {
      try {
        const response = await api.get('/users');
        setUsers(response.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al cargar usuarios');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [router]);

  const handleEdit = (userId: number) => {
    router.push(`/users/edit/${userId}`);
  };

  const handleToggleActive = async (userId: number, currentActive: boolean) => {
    const action = currentActive ? 'inactivar' : 'activar';
    if (!confirm(`¿Estás seguro de que quieres ${action} este usuario?`)) {
      return;
    }

    try {
      await api.patch(`/users/${userId}`, { active: !currentActive });
      setUsers(prevUsers =>
        prevUsers.map(u =>
          u.id === userId ? { ...u, active: !currentActive } : u
        )
      );
      alert(`Usuario ${action}do con éxito`);
    } catch (err: any) {
      console.error('Error al actualizar estado:', err);
      alert(err.response?.data?.error || `Error al ${action} el usuario`);
    }
  };

  if (loading) return <div className="p-8 text-center">Cargando usuarios...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <Header />
        <main className="p-8">
          <h1 className="text-3xl font-bold text-[#001F3F] mb-8">Listado de Usuarios</h1>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  {isSuper && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.fullName || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.role?.name || 'Sin rol'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {user.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>

                    {/* Acciones solo para superusuario */}
                    {isSuper && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEdit(user.id)}
                          className="text-blue-600 hover:text-blue-900 mr-4 font-medium"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggleActive(user.id, user.active)}
                          className={`font-medium ${user.active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}
                        >
                          {user.active ? 'Inactivar' : 'Activar'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}