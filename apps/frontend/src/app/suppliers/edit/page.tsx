'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Topbar from '@/components/Topbar';
import { ROUTES } from '@/constants/routes';
import { fetchSupplierById, updateSupplierRequest } from '@/lib/suppliersApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';

function SupplierEditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams?.get('id');
  const supplierId = idParam ? parseInt(idParam, 10) : NaN;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [internalCode, setInternalCode] = useState('');
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');

  useEffect(() => {
    if (!Number.isFinite(supplierId) || supplierId < 1) {
      setLoading(false);
      setLoadError('ID de proveedor no válido');
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const s = await fetchSupplierById(supplierId);
        if (cancelled) return;
        setInternalCode(s.internalCode);
        setName(s.name);
        setTaxId(s.taxId);
        setPhone(s.phone);
        setAddress(s.address);
        setContactPerson(s.contactPerson);
      } catch (e) {
        if (cancelled) return;
        if (isUnauthorized(e)) {
          router.push('/login');
          return;
        }
        setLoadError(getApiErrorMessage(e, 'No se pudo cargar el proveedor'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supplierId, router]);

  const handleUpdate = async () => {
    if (!Number.isFinite(supplierId) || supplierId < 1) return;
    if (!internalCode || !name || !taxId || !phone || !address) {
      alert('Completa código interno, nombre, NIT/RUT, teléfono y dirección.');
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

  if (loading) {
    return (
      <>
        <Topbar title="Editar proveedor" />
        <div className="content-card" style={{ padding: '2rem', textAlign: 'center' }}>
          Cargando…
        </div>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <Topbar title="Editar proveedor" />
        <div className="content-card" style={{ padding: '1.5rem' }}>
          <p style={{ color: '#b91c1c' }}>{loadError}</p>
          <Link href={ROUTES.suppliers.list} className="btn btn-outline mt-4 inline-block">
            Volver al listado
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Editar proveedor" />

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
              />
            </div>
            <div className="input-group full-width">
              <label>Razón social / nombre:</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
            </div>
            <div className="input-group">
              <label>NIT / RUT:</label>
              <input type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} className="input-field" />
            </div>
            <div className="input-group">
              <label>Teléfono:</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field" />
            </div>
            <div className="input-group full-width">
              <label>Dirección:</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="input-field" />
            </div>
            <div className="input-group full-width">
              <label>Persona de contacto:</label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="input-field"
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
            onClick={() => void handleUpdate()}
            disabled={submitting}
          >
            {submitting ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </>
  );
}

export default function SupplierEditPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <SupplierEditContent />
    </Suspense>
  );
}
