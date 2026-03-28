'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { api } from '../../utils/api';
import { hasPermission } from "@/utils/permissions";



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
  // 🔥 PROTECCIÓN DE RUTA
  if (!hasPermission("users.read")) {
    alert("No cuentas con los permisos para acceder a este módulo");
    router.push("/dashboard");
    return;
  }

  // 🔥 YA AUTORIZADO → CARGA DATOS
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
}, []); 
 

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
              {isSuper && <th className="px-6 py-3">Acciones</th>}
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
                      

                {isSuper && (
                  <td className="px-6 py-4 text-sm">

                    <button
                      onClick={() => handleEdit(user.id)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Editar
                    </button>

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












































































































