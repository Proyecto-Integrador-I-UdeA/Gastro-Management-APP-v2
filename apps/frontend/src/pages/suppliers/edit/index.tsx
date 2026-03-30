'use client';


import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { ROUTES } from '@/constants/routes';
import { fetchSupplierById, updateSupplierRequest } from '@/lib/suppliersApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { useAuthGuard } from "@/hooks/useAuthGuard";


export default function SupplierEditPage() {
  const router = useRouter();
  useAuthGuard("suppliers.update");
  const { id } = router.query;


  const supplierId = id ? parseInt(id as string, 10) : NaN;


  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);


  const [internalCode, setInternalCode] = useState('');
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');


  useEffect(() => {
    if (!router.isReady) return;


    if (!Number.isFinite(supplierId) || supplierId < 1) {
      setLoading(false);
      setError('ID de proveedor no válido');
      return;
    }


    const loadSupplier = async () => {
      try {
        const s = await fetchSupplierById(supplierId);
        setInternalCode(s.internalCode);
        setName(s.name);
        setTaxId(s.taxId);
        setPhone(s.phone);
        setAddress(s.address);
        setContactPerson(s.contactPerson);
      } catch (e) {
        if (isUnauthorized(e)) {
          router.push('/login');
          return;
        }
        setError(getApiErrorMessage(e, 'No se pudo cargar el proveedor'));
      } finally {
        setLoading(false);
      }
    };


    loadSupplier();
  }, [supplierId, router.isReady]);


  const handleUpdate = async () => {
    if (!internalCode || !name || !taxId || !phone || !address) {
      alert('Completa todos los campos obligatorios');
      return;
    }


    setSubmitting(true);


    try {
      await updateSupplierRequest(supplierId, {
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


      alert(getApiErrorMessage(e, 'No se pudo actualizar el proveedor'));


    } finally {
      setSubmitting(false);
    }
  };


  return (
    <DashboardLayout>


      <h1 className="text-2xl font-bold text-[#001F3F] mb-6">
        Editar proveedor
      </h1>


      {loading && (
        <div className="text-center py-10">Cargando...</div>
      )}


      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
          {error}
        </div>
      )}


      {!loading && !error && (
        <div className="bg-white p-6 rounded-xl shadow-md max-w-3xl">


          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">


            <Input
              label="Código interno"
              value={internalCode}
              onChange={(e) => setInternalCode(e.target.value)}
            />


            <Input
              label="NIT / RUT"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
            />


            <Input
              label="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="md:col-span-2"
            />


            <Input
              label="Teléfono"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />


            <Input
              label="Dirección"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="md:col-span-2"
            />


            <Input
              label="Persona de contacto"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
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
              onClick={handleUpdate}
              disabled={submitting}
            >
              {submitting ? 'Guardando…' : 'Guardar cambios'}
            </Button>


          </div>


        </div>
      )}


    </DashboardLayout>
  );
}

