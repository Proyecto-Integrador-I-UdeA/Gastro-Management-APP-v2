'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Topbar from '@/components/Topbar';
import { ROUTES } from '@/constants/routes';
import { createSupplierRequest } from '@/lib/suppliersApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';

export default function SupplierCreatePage() {
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
    <>
      <Topbar title="Nuevo proveedor" />

      <div id="form-view" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
        <section className="form-section">
          <div className="form-section-header">
            <h3>Datos del proveedor</h3>
          </div>
          <hr className="section-divider" />

          <div className="form-grid">
            <div className="input-group-inline right-aligned">
              <label>Código interno:</label>
              <input
                type="text"
                value={internalCode}
                onChange={(e) => setInternalCode(e.target.value)}
                className="input-field text-center"
                style={{ width: '160px' }}
                placeholder="SUP-001"
              />
            </div>
            <div className="input-group full-width">
              <label>Razón social / nombre:</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder="Nombre del proveedor"
              />
            </div>
            <div className="input-group">
              <label>NIT / RUT:</label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="input-field"
                placeholder="Identificación fiscal"
              />
            </div>
            <div className="input-group">
              <label>Teléfono:</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field"
                placeholder="Contacto telefónico"
              />
            </div>
            <div className="input-group full-width">
              <label>Dirección:</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input-field"
                placeholder="Dirección completa"
              />
            </div>
            <div className="input-group full-width">
              <label>Persona de contacto (opcional):</label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="input-field"
                placeholder="Nombre del contacto"
              />
            </div>
          </div>
        </section>

        <div className="form-actions">
          <Link href={ROUTES.suppliers.list} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center' }}>
            Cancelar
          </Link>
          <button
            type="button"
            className="btn btn-success"
            onClick={() => void handleSave()}
            disabled={submitting}
          >
            {submitting ? 'Guardando…' : 'Guardar proveedor'}
          </button>
        </div>
      </div>
    </>
  );
}
