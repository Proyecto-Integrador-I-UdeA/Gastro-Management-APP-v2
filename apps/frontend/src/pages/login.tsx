import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Input from '../components/Input';
import Button from '../components/Button';
import { api } from '../utils/api';
import { useEffect, useState } from 'react';
import Header from '../components/Header';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  // 🔥 FECHA Y HORA
  const [currentDateTime, setCurrentDateTime] = useState('');

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

  const onSubmit = async (data: LoginForm) => {
    try {
      const response = await api.post('/auth/login', data);
      const token = response.data.token;
      localStorage.setItem('token', token);
      alert('¡Login exitoso! Redirigiendo...');
      globalThis.location.href = '/dashboard';
    } catch (error: any) {
      const errMsg = error.response?.data?.error || error.message || 'Error desconocido';
      alert(errMsg);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">

      {/* HEADER */}
      <div className="fixed top-0 left-0 lg:left-80 right-0 z-50">
        <Header showUser={false} />
      </div>

      {/* SIDEBAR */}
      <div className="w-80 bg-[#001F3F] hidden lg:block fixed h-full pt-2">
        <div className="h-full grid grid-rows-3 gap-6 p-4">

          <div className="flex flex-col bg-gray-800 overflow-hidden shadow-2xl">
            <div className="h-[96%] bg-cover bg-center"
              style={{ backgroundImage: "url('/images/costos  calculados, utilidad segura.jpg')" }} />
            <p className="text-white text-center py-1 text-sm bg-black/60">
              Costos calculados, utilidad segura
            </p>
          </div>

          <div className="flex flex-col bg-gray-800 overflow-hidden shadow-2xl">
            <div className="h-[96%] bg-cover bg-center"
              style={{ backgroundImage: "url('/images/estandariza tu menu y fideliza tus clientes.jpg')" }} />
            <p className="text-white text-center py-1 text-sm bg-black/60">
              Establece precios justos para tu negocio
            </p>
          </div>

          <div className="flex flex-col bg-gray-800 overflow-hidden shadow-2xl">
            <div className="h-[96%] bg-cover bg-center"
              style={{ backgroundImage: "url('/images/controla tus inventarios y asegura tus ganancias.jpg')" }} />
            <p className="text-white text-center py-1 text-sm bg-black/60">
              Controla inventarios y asegura tu ganancia
            </p>
          </div>

        </div>
      </div>

      {/* FORMULARIO */}
      <div className="flex items-center justify-center lg:ml-80 pt-40">
        <div className="bg-white p-10 rounded-xl shadow-2xl w-full max-w-md mx-4">

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

            <Button type="submit" className="w-full">
              Iniciar Sesión
            </Button>

          </form>

          {/* 🔥 FECHA Y HORA */}
          <p className="text-center text-sm text-gray-500 mt-6">
            {currentDateTime}
          </p>

        </div>
      </div>

    </div>
  );
}















































































































































































































































