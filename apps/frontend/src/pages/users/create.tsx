import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import Input from '../../components/Input';
import Dropdown from '../../components/Dropdown';
import Button from '../../components/Button';

export default function CreateUser() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <Header />
        <main className="p-8">
          <h1 className="text-3xl font-bold text-[#001F3F] mb-8">Crear Usuario</h1>

          <div className="bg-white p-8 rounded-xl shadow-md">
            <form className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Email" type="email" />
                <Input label="Contraseña" type="password" />
              </div>

              <Input label="Nombre Completo" />

              <Dropdown
                label="Rol"
                options={[
                  { value: '1', label: 'Superusuario' },
                  { value: '2', label: 'Administrador' },
                  { value: '3', label: 'Chef' },
                  { value: '4', label: 'Jefe de Compras' },
                  { value: '5', label: 'Contabilidad' },
                ]}
              />

              <div className="flex justify-end space-x-4 pt-6">
                <Button variant="secondary">Cancelar</Button>
                <Button>Guardar Usuario</Button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}