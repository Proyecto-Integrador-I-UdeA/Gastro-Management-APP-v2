'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/router';
import Input from '../../components/Input';
import Dropdown from '../../components/Dropdown';
import Button from '../../components/Button';
import { api } from '../../utils/api';
import Sidebar from '../../components/Sidebar';
import Header from '../../components/Header';

const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  fullName: z.string().min(3, 'Nombre completo requerido'),
  roleId: z.number().int().positive('Selecciona un rol'),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

export default function CreateUser() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors }, setValue } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      roleId: undefined,
    },
  });

  const onSubmit = async (data: CreateUserForm) => {
    console.log('Datos que se envían al backend:', data);
    console.log('Tipo de roleId:', typeof data.roleId, 'Valor:', data.roleId);

    try {
      const response = await api.post('/auth/register', data);
      alert('Usuario creado exitosamente');
      router.push('/users');
    } catch (error: any) {
      console.error('Error completo:', error);
      alert(error.response?.data?.error || 'Error al crear usuario');
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <Header />
        <main className="p-8">
          <h1 className="text-3xl font-bold text-[#001F3F] mb-8">Crear Usuario</h1>

          <div className="bg-white p-8 rounded-xl shadow-md">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
              <Input label="Contraseña" type="password" {...register('password')} error={errors.password?.message} />
              <Input label="Nombre Completo" {...register('fullName')} error={errors.fullName?.message} />

              {/* Dropdown con conversión forzada a número */}
              <Dropdown
                label="Rol"
                error={errors.roleId?.message}
                options={[
                  { value: 1, label: 'Superusuario' },
                  { value: 2, label: 'Administrador' },
                  { value: 3, label: 'Chef' },
                  { value: 4, label: 'Jefe de Compras' },
                  { value: 5, label: 'Contabilidad' },
                ]}
                {...register('roleId')}
                onChange={(e) => {
                  const selected = e.target.value;
                  console.log('Valor seleccionado en dropdown (crudo):', selected);
                  const numValue = selected ? Number(selected) : undefined;
                  console.log('Valor convertido a número:', numValue, 'Tipo:', typeof numValue);
                  setValue('roleId', numValue, { shouldValidate: true, shouldDirty: true });
                }}
              />

              <div className="flex justify-end space-x-4 pt-6">
                <Button type="button" variant="secondary" onClick={() => router.push('/users')}>
                  Cancelar
                </Button>
                <Button type="submit">Guardar Usuario</Button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}