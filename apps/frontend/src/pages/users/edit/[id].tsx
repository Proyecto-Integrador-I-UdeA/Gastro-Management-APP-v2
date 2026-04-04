'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import Input from '@/components/Input';
import Dropdown from '@/components/Dropdown';
import Button from '@/components/Button';
import { api } from '@/utils/api';
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { showError, showSuccess } from '@/utils/toast';

interface FormData {
  email: string;
  fullName: string;
  password: string;
  roleId: number | undefined;
}

export default function EditUser() {
  useAuthGuard("users.read");
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState<FormData>({
    email: '',
    fullName: '',
    password: '',
    roleId: undefined,
  });

  useEffect(() => {
    if (!router.isReady) return;

    const fetchUser = async () => {
      try {
        const response = await api.get(`/users/${id}`);

        setFormData({
          email: response.data.email || '',
          fullName: response.data.fullName || '',
          password: '',
          roleId: response.data.roleId || undefined,
        });

      } catch (err) {
        console.error(err);
        showError('Error al cargar usuario');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router.isReady, id]);

  const handleChange = (e: any) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: name === 'roleId' ? Number(value) : value,
    }));
  };

  const onSubmit = async (e: any) => {
    e.preventDefault();

    const updateData: any = {};

    if (formData.email) updateData.email = formData.email;
    if (formData.fullName) updateData.fullName = formData.fullName;
    if (formData.roleId !== undefined) updateData.roleId = formData.roleId;

    if (Object.keys(updateData).length === 0) {
      showError('No hay cambios para guardar');
      return;
    }

    try {
      await api.put(`/users/${id}`, updateData);
      showSuccess('Usuario actualizado');
      router.push('/users');
    } catch (err: any) {
      showError(err.response?.data?.error || 'Error al actualizar');
    }
  };

  return (
    <DashboardLayout>

      <h1 className="text-2xl font-bold text-[#001F3F] mb-6">
        Editar Usuario
      </h1>

      {loading ? (
        <div className="text-center py-10">Cargando usuario...</div>
      ) : (
        <div className="bg-white p-6 rounded-xl shadow-md max-w-lg">

          <form onSubmit={onSubmit} className="space-y-6">

            <Input
              label="Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
            />

            <Input
              label="Nombre Completo"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
            />

            <Dropdown
              label="Rol"
              name="roleId"
              value={formData.roleId}
              onChange={handleChange}
              options={[
                { value: 1, label: 'Superusuario' },
                { value: 2, label: 'Administrador' },
                { value: 3, label: 'Chef' },
                { value: 4, label: 'Jefe de Compras' },
                { value: 5, label: 'Contabilidad' },
              ]}
            />

            <div className="flex justify-end gap-4 pt-4">

              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push('/users')}
              >
                Cancelar
              </Button>

              <Button type="submit">
                Guardar cambios
              </Button>

            </div>

          </form>

        </div>
      )}

    </DashboardLayout>
  );
}











































































































