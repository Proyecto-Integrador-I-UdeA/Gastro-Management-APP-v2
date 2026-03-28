'use client';


import { useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { ROUTES } from '@/constants/routes';
import { createSupplierRequest } from '@/lib/suppliersApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { useAuthGuard } from "@/hooks/useAuthGuard";


export default function SupplierCreatePage() {
  useAuthGuard("users.read");
  const router = useRouter();


  const [submitting, setSubmitting] = useState(false);
  const [internalCode, setInternalCode] = useState('');
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');


  const handleSave = async () => {
    if (!internalCode || !name || !taxId || !phone || !address) {
      alert('Completa código interno, nombre, NIT/RUT, teléfono y dirección.');
      return;
    }


    setSubmitting(true);


    try {
      await createSupplierRequest({
        internalCode,
        name,
        taxId,
        phone,
        address,
        contactPerson: contactPerson.trim(),
      });


      router.push(ROUTES.suppliers.list);


    } catch (e) {
      if (isUnauthorized(e)) {
        router.push('/login');
        return;
      }


      alert(getApiErrorMessage(e, 'No se pudo crear el proveedor'));


    } finally {
      setSubmitting(false);
    }
  };


  return (
    <DashboardLayout>


      <h1 className="text-2xl font-bold text-[#001F3F] mb-6">
        Nuevo proveedor
      </h1>


      <div className="bg-white p-6 rounded-xl shadow-md max-w-3xl">


        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">


          <Input
            label="Código interno"
            value={internalCode}
            onChange={(e) => setInternalCode(e.target.value)}
            placeholder="SUP-001"
          />


          <Input
            label="NIT / RUT"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            placeholder="Identificación fiscal"
          />


          <Input
            label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del proveedor"
            className="md:col-span-2"
          />


          <Input
            label="Teléfono"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Contacto telefónico"
          />


          <Input
            label="Dirección"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Dirección completa"
            className="md:col-span-2"
          />


          <Input
            label="Persona de contacto (opcional)"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            placeholder="Nombre del contacto"
            className="md:col-span-2"
          />


        </div>


        <div className="flex justify-end gap-4 mt-6">


          <Button
            variant="secondary"
            onClick={() => router.push(ROUTES.suppliers.list)}
          >
            Cancelar
          </Button>


          <Button
            onClick={handleSave}
            disabled={submitting}
          >
            {submitting ? 'Guardando…' : 'Guardar proveedor'}
          </Button>


        </div>


      </div>


    </DashboardLayout>
  );
}





