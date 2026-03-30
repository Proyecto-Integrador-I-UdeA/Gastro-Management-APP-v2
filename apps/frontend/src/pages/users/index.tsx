'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { api } from '../../utils/api';
import { getUserPermissions } from "@/utils/permissions";
import { showError } from '@/utils/toast';

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

  // 🔥 PERMISOS
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const perms = getUserPermissions();
    setPermissions(perms);
    setLoaded(true);
  }, []);

  const can = (perm: string) =>
    permissions.some(p => p.trim().toLowerCase() === perm.toLowerCase());

  const canEdit = loaded && can("users.update");
  const canDelete = loaded && can("users.delete");

  // 🔥 FETCH USERS
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get('/users');
        setUsers(response.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al cargar usuarios');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleEdit = (userId: number) => {
    router.push(`/users/edit/${userId}`);
  };

  const handleToggleActive = async (userId: number, currentActive: boolean) => {
    const action = currentActive ? 'inactivar' : 'activar';

    if (!confirm(`¿Estás seguro de que quieres ${action} este usuario?`)) return;

    try {
      await api.patch(`/users/${userId}`, { active: !currentActive });

      setUsers(prevUsers =>
        prevUsers.map(u =>
          u.id === userId ? { ...u, active: !currentActive } : u
        )
      );

      showError(`Usuario ${action}do con éxito`);
    } catch (err: any) {
      console.error('Error al actualizar estado:', err);
      showError(err.response?.data?.error || `Error al ${action} el usuario`);
    }
  };

  if (loading) return <div className="p-8 text-center">Cargando usuarios...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;

  return (
    <DashboardLayout>

      <h1 className="text-3xl font-bold text-[#001F3F] mb-8">
        Listado de Usuarios
      </h1>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">

          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>

              {(canEdit || canDelete) && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              )}
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">

                <td className="px-6 py-4 text-sm">{user.id}</td>
                <td className="px-6 py-4 text-sm">{user.email}</td>
                <td className="px-6 py-4 text-sm">{user.fullName || '-'}</td>
                <td className="px-6 py-4 text-sm">{user.role?.name || 'Sin rol'}</td>

                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {user.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>

                {(canEdit || canDelete) && (
                  <td className="px-6 py-4 text-sm">

                    {canEdit && (
                      <button
                        onClick={() => handleEdit(user.id)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Editar
                      </button>
                    )}

                    {canDelete && (
                      <button
                        onClick={() => handleToggleActive(user.id, user.active)}
                        className={`${
                          user.active
                            ? 'text-red-600 hover:text-red-900'
                            : 'text-green-600 hover:text-green-900'
                        }`}
                      >
                        {user.active ? 'Inactivar' : 'Activar'}
                      </button>
                    )}

                  </td>
                )}

              </tr>
            ))}
          </tbody>

        </table>
      </div>

    </DashboardLayout>
  );
}































































































