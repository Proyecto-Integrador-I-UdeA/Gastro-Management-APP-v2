'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Input from '../components/Input';
import Button from '../components/Button';
import { api } from '../utils/api';

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

  const onSubmit = async (data: LoginForm) => {
    console.log('Enviando al backend:', data);
    try {
      const response = await api.post('/auth/login', data);
      const token = response.data.token;
      localStorage.setItem('token', token);
      console.log('Login exitoso - Token guardado:', token);
      alert('¡Login exitoso! Redirigiendo...');
      globalThis.location.href = '/dashboard'; // redirige al dashboard
    } catch (error: any) {
      console.error('Error en login:', error);
      const errMsg = error.response?.data?.error || error.message || 'Error desconocido';
      alert(errMsg);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Franja superior azul fija con nombre y slogan */}
      <div className="fixed top-0 left-0 right-0 h-20 bg-[#001F3F] z-50 flex items-center justify-center shadow-md">
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]">
            Gastronomic Management App
          </h1>
          <p className="text-sm md:text-base text-white/90 mt-1 drop-shadow-md">
            Precisión culinaria, rentabilidad garantizada
          </p>
        </div>
      </div>

{/* Franja izquierda azul con 3 imágenes grandes y frases más pequeñas */}
<div className="w-80 bg-[#001F3F] hidden lg:block fixed h-full pt-20 overflow-y-auto">
  <div className="h-full grid grid-rows-3 gap-4 p-3">
    {/* Tarjeta 1 */}
    <div className="grid-rows-1 flex flex-col bg-gray-800 rounded-xl overflow-hidden shadow-2xl">
      <div className="h-[96%] bg-cover bg-center" 
           style={{ backgroundImage: "url('/images/costos  calculados, utilidad segura.jpg')" }}>
      </div>
      <p className="h-[4%] text-white text-center py-1.5 font-medium text-[0.65rem] leading-tight bg-black/60 backdrop-blur-sm flex items-center justify-center px-2">
        Costos calculados, utilidad segura
      </p>
    </div>

    {/* Tarjeta 2 */}
    <div className="grid-rows-1 flex flex-col bg-gray-800 rounded-xl overflow-hidden shadow-2xl">
      <div className="h-[96%] bg-cover bg-center" 
           style={{ backgroundImage: "url('/images/estandariza tu menu y fideliza tus clientes.jpg')" }}>
      </div>
      <p className="h-[4%] text-white text-center py-1.5 font-medium text-[0.65rem] leading-tight bg-black/60 backdrop-blur-sm flex items-center justify-center px-2">
        Establece precios justos para tus clientes y para tu negocio
      </p>
    </div>

    {/* Tarjeta 3 */}
    <div className="grid-rows-1 flex flex-col bg-gray-800 rounded-xl overflow-hidden shadow-2xl">
      <div className="h-[96%] bg-cover bg-center" 
           style={{ backgroundImage: "url('/images/controla tus inventarios y asegura tus ganancias.jpg')" }}>
      </div>
      <p className="h-[4%] text-white text-center py-1.5 font-medium text-[0.65rem] leading-tight bg-black/60 backdrop-blur-sm flex items-center justify-center px-2">
        Controla tus inventarios y asegura tu ganancia
      </p>
    </div>
  </div>
</div>

      {/* Formulario centrado (tu código original intacto) */}
      <div className="flex-1 flex items-center justify-center lg:ml-80 pt-20">
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
        </div>
      </div>
    </div>
  );
}


























































































































































































