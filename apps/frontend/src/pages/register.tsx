'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Button from '@/components/Button';
import Header from '@/components/Header';
import Input from '@/components/Input';
import { ROUTES } from '@/constants/routes';
import { apiFetch } from '@/lib/api';
import { showError, showSuccess } from '@/utils/toast';

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Nombre completo requerido'),
  email: z.string().trim().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string().min(1, 'Confirma la contraseña'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const router = useRouter();
  const [registrationAvailable, setRegistrationAvailable] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
  });

  useEffect(() => {
    let isMounted = true;

    apiFetch('/auth/register/status')
      .then((status) => {
        if (isMounted) {
          setRegistrationAvailable(status.registrationAvailable === true);
        }
      })
      .catch((error) => {
        console.error('No fue posible consultar el estado del registro:', error);
        if (isMounted) {
          setStatusError('No fue posible verificar si el registro inicial está disponible.');
          setRegistrationAvailable(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const onSubmit = async ({ confirmPassword: _confirmPassword, ...data }: RegisterForm) => {
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      showSuccess('Cuenta inicial creada exitosamente');
      await router.push(ROUTES.login);
    } catch (error: any) {
      const message = error?.message || 'Error al crear la cuenta inicial';
      if (message === 'El registro inicial ya fue completado') {
        setRegistrationAvailable(false);
      }
      showError(message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="fixed top-0 left-0 lg:left-80 right-0 z-50">
        <Header showUser={false} />
      </div>

      <div className="w-80 bg-[#001F3F] hidden lg:block fixed h-full pt-2">
        <div className="h-full grid grid-rows-3 gap-6 p-4">
          <div className="flex flex-col bg-gray-800 overflow-hidden shadow-2xl">
            <div
              className="h-[96%] bg-cover bg-center"
              style={{ backgroundImage: "url('/images/costos  calculados, utilidad segura.jpg')" }}
            />
            <p className="text-white text-center py-1 text-sm bg-black/60">
              Costos calculados, utilidad segura
            </p>
          </div>

          <div className="flex flex-col bg-gray-800 overflow-hidden shadow-2xl">
            <div
              className="h-[96%] bg-cover bg-center"
              style={{ backgroundImage: "url('/images/estandariza tu menu y fideliza tus clientes.jpg')" }}
            />
            <p className="text-white text-center py-1 text-sm bg-black/60">
              Establece precios justos para tu negocio
            </p>
          </div>

          <div className="flex flex-col bg-gray-800 overflow-hidden shadow-2xl">
            <div
              className="h-[96%] bg-cover bg-center"
              style={{ backgroundImage: "url('/images/controla tus inventarios y asegura tus ganancias.jpg')" }}
            />
            <p className="text-white text-center py-1 text-sm bg-black/60">
              Controla inventarios y asegura tu ganancia
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center lg:ml-80 pt-36 pb-10">
        <div className="bg-white p-10 rounded-xl shadow-2xl w-full max-w-md mx-4">
          <h1 className="text-2xl font-bold text-[#001F3F] text-center mb-2">
            Crear cuenta inicial
          </h1>
          <p className="text-center text-sm text-gray-600 mb-6">
            Configura la primera cuenta administradora de GastroManagement.
          </p>

          {registrationAvailable === null && (
            <p className="text-center text-gray-600">Consultando disponibilidad...</p>
          )}

          {registrationAvailable === false && (
            <div className="space-y-5 text-center">
              <p className="text-gray-700">
                {statusError || 'El registro inicial ya fue completado.'}
              </p>
              <Link href={ROUTES.login} className="font-semibold text-[#001F3F] hover:underline">
                Volver a iniciar sesión
              </Link>
            </div>
          )}

          {registrationAvailable === true && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <Input
                label="Nombre completo"
                autoComplete="name"
                {...register('fullName')}
                error={errors.fullName?.message}
              />

              <Input
                label="Email"
                type="email"
                autoComplete="email"
                {...register('email')}
                error={errors.email?.message}
              />

              <Input
                label="Contraseña"
                type="password"
                autoComplete="new-password"
                {...register('password')}
                error={errors.password?.message}
              />

              <Input
                label="Confirmar contraseña"
                type="password"
                autoComplete="new-password"
                {...register('confirmPassword')}
                error={errors.confirmPassword?.message}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
              </Button>

              <p className="text-center text-sm text-gray-600">
                <Link href={ROUTES.login} className="font-medium text-[#001F3F] hover:underline">
                  Volver a iniciar sesión
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
