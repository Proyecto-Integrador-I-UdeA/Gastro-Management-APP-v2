import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Input from '../components/Input';
import Button from '../components/Button';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

 const onSubmit = async (data: LoginForm) => {
  try {
    const response = await api.post('/auth/login', data);
    const token = response.data.token;
    localStorage.setItem('token', token); // Guarda el token
    console.log('Login exitoso, token guardado:', token);
    window.location.href = '/'; // Redirige al dashboard (o '/dashboard')
  } catch (error: any) {
    console.error('Error en login:', error);
    alert(error.response?.data?.error || 'Credenciales inválidas');
  }
};
 
 
 

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-10 rounded-xl shadow-xl w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-[#001F3F]">Gastronomic Management App</h1>
          <p className="text-gray-600 mt-2">Precisión culinaria, rentabilidad garantizada</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
          <Input label="Contraseña" type="password" {...register('password')} error={errors.password?.message} />

          <Button type="submit" className="w-full">Iniciar Sesión</Button>
        </form>
      </div>
    </div>
  );
}