'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/router';
import Input from '../../components/Input';
import Dropdown from '../../components/Dropdown';
import Button from '../../components/Button';
import { api } from '../../utils/api';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useAuthGuard } from "@/hooks/useAuthGuard";

const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  fullName: z.string().min(3, 'Nombre completo requerido'),
  roleId: z.number().int().positive('Selecciona un rol'),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

export default function CreateUser() {
  useAuthGuard("users.read");
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      roleId: undefined,
    },
  });

  const onSubmit = async (data: CreateUserForm) => {
    try {
      await api.post('/auth/register', data);
      alert('Usuario creado exitosamente');
      router.push('/users');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al crear usuario');
    }
  };

  return (
    <DashboardLayout>

      <h1 className="text-3xl font-bold text-[#001F3F] mb-2">
        Crear Usuario
      </h1>

      <div className="bg-white p-8 rounded-xl shadow-md max-w-2xl">

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          <Input
            label="Email"
            type="email"
            {...register('email')}
            error={errors.email?.message}
          />

          <Input
            label="Contraseña"
            type="password"
            {...register('password')}
            error={errors.password?.message}
          />

          <Input
            label="Nombre Completo"
            {...register('fullName')}
            error={errors.fullName?.message}
          />

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
              if (!selected) return;
              setValue('roleId', Number(selected), {
                shouldValidate: true,
                shouldDirty: true,
              });
            }}
          />

          <div className="flex justify-end space-x-4 pt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/users')}
            >
              Cancelar
            </Button>

            <Button type="submit">
              Guardar Usuario
            </Button>
          </div>

        </form>

      </div>

    </DashboardLayout>
  );
}


















































































