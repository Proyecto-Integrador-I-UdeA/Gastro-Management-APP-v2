'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../../../components/Header';
import Sidebar from '../../../components/Sidebar';
import Input from '../../../components/Input';
import Dropdown from '../../../components/Dropdown';
import Button from '../../../components/Button';
import { api } from '../../../utils/api';

interface FormData {
  email: string;
  fullName: string;
  password: string;
  roleId: number | undefined;
}
export default function EditUser() {
  const router = useRouter();
  const { id } = router.query;
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<FormData>({
    email: '',
    fullName: '',
    password: '',
    roleId: undefined,
  });

  useEffect(() => {
    if (!id) return;

const fetchUser = async () => {
  try {
    console.log('ID recibido:', id);
    const token = localStorage.getItem('token');
    console.log('Token que se va a enviar:', token ? 'Sí existe' : 'NO existe');

    if (!token) {
      throw new Error('No hay token en localStorage');
    }

    const response = await api.get(`/users/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('Respuesta GET:', response.status, response.data);

    if (response.status >= 200 && response.status < 300) {
      setUser(response.data);
      setFormData({
        email: response.data.email || '',
        fullName: response.data.fullName || '',
        password: '',
        roleId: response.data.roleId || undefined,
      });
    } else {
      throw new Error(`Error ${response.status}`);
    }
  } catch (err) {
    console.error('Error completo:', err);
    alert('Error al cargar el usuario. Verifica la consola.');
  } finally {
    setLoading(false);
  }
};


    fetchUser();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'roleId' ? Number(value) : value,
    }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    // Preparar datos a enviar: solo campos que no estén vacíos
    const updateData = {};
    if (formData.email) updateData.email = formData.email;
    if (formData.fullName) updateData.fullName = formData.fullName;
    if (formData.password) updateData.password = formData.password;
    if (formData.roleId !== undefined) updateData.roleId = formData.roleId;

    if (Object.keys(updateData).length === 0) {
      alert('No hay cambios para guardar');
      return;
    }

    try {
      await api.put(`/users/${id}`, updateData);
      alert('Usuario actualizado con éxito');
      router.push('/users');
    } catch (err) {
      console.error('Error al actualizar:', err);
      alert(err.response?.data?.error || 'Error al actualizar usuario');
    }
  };

  if (loading) return <div className="p-8 text-center">Cargando usuario...</div>;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <Header />
        <main className="p-8">
          <h1 className="text-3xl font-bold text-[#001F3F] mb-8">Editar Usuario</h1>

          <div className="bg-white p-8 rounded-xl shadow-md max-w-lg">
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
              <Input
                label="Nueva Contraseña (opcional)"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
              />

              {/* Campo Rol */}
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

              <div className="flex justify-end space-x-4">
                <Button type="button" variant="secondary" onClick={() => router.push('/users')}>
                  Cancelar
                </Button>
                <Button type="submit">Guardar Cambios</Button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}