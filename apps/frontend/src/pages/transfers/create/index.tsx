'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Button from '@/components/Button';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import Input from '@/components/Input';
import { ROUTES } from '@/constants/routes';
import { fetchProductsWithSuppliers } from '@/lib/productsApi';
import Link from 'next/link';
import { fetchWarehouses } from '@/lib/warehousesApi';
import { createInventoryMovementRequest } from '@/lib/inventoryMovementsApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { showError, showSuccess } from '@/utils/toast';
import type { Product } from '@/types/product';
import type { WarehouseSummary } from '@/types/transfer';
import { formatProductInputUnitLabel } from '@/lib/productUnits';

type MovementMode = 'transfer' | 'purchase';

export default function CreateTransferPage() {
  useAuthGuard('transfers.create');

  const router = useRouter();
  const [mode, setMode] = useState<MovementMode>('transfer');
  const [warehouses, setWarehouses] = useState<WarehouseSummary[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingRefs, setLoadingRefs] = useState(true);

  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadReferences = useCallback(async () => {
    setLoadingRefs(true);
    setLoadError(null);
    try {
      const [wh, prods] = await Promise.all([
        fetchWarehouses(true),
        fetchProductsWithSuppliers(),
      ]);
      setWarehouses(wh);
      setProducts(prods.filter((p) => p.active !== false));
    } catch (e) {
      if (isUnauthorized(e)) {
        router.push('/login');
        return;
      }
      setLoadError(
        getApiErrorMessage(
          e,
          'No se pudieron cargar bodegas o productos. Verifica permisos (productos y traslados).'
        )
      );
    } finally {
      setLoadingRefs(false);
    }
  }, [router]);

  useEffect(() => {
    loadReferences();
  }, [loadReferences]);

  const selectedProduct = useMemo(
    () => products.find((x) => String(x.id) === productId),
    [products, productId]
  );

  const principalWarehouse = useMemo(
    () => warehouses.find((w) => Boolean(w.isMain)),
    [warehouses]
  );

  useEffect(() => {
    if (mode !== 'purchase' || !principalWarehouse) return;
    setDestinationWarehouseId(String(principalWarehouse.id));
  }, [mode, principalWarehouse]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    let pid: number;
    let qty: number;
    try {
      pid = parseInt(productId, 10);
      qty = parseFloat(String(quantity ?? '').replace(',', '.'));
    } catch {
      setFormError('Error al leer cantidad o producto.');
      showError('Error al leer cantidad o producto.');
      return;
    }

    let dst: number;
    if (mode === 'purchase') {
      if (!principalWarehouse) {
        const msg =
          'No hay bodega principal. Marca una en Bodegas (editar bodega → «Bodega principal») antes de registrar compras.';
        setFormError(msg);
        showError(msg);
        return;
      }
      dst = Number(principalWarehouse.id);
      if (!Number.isFinite(dst) || dst < 1) {
        const msg = 'La bodega principal no tiene un identificador válido. Recarga la página o revisa las bodegas.';
        setFormError(msg);
        showError(msg);
        return;
      }
    } else {
      dst = parseInt(destinationWarehouseId, 10);
      if (!destinationWarehouseId) {
        setFormError('Completa todos los campos obligatorios');
        return;
      }
      if (Number.isNaN(dst)) {
        setFormError('Valores numéricos inválidos');
        return;
      }
    }

    if (!productId || !quantity) {
      setFormError('Completa todos los campos obligatorios');
      return;
    }
    if (Number.isNaN(pid) || Number.isNaN(qty)) {
      setFormError('Valores numéricos inválidos');
      return;
    }
    if (qty <= 0) {
      setFormError('La cantidad debe ser mayor a cero');
      return;
    }

    if (mode === 'transfer') {
      const src = parseInt(sourceWarehouseId, 10);
      if (!sourceWarehouseId) {
        setFormError('Selecciona bodega de origen');
        return;
      }
      if (Number.isNaN(src)) {
        setFormError('Bodega origen inválida');
        return;
      }
      if (src === dst) {
        setFormError('Origen y destino deben ser distintos');
        return;
      }

      setSubmitting(true);
      try {
        await createInventoryMovementRequest({
          type: 'TRANSFER',
          productId: pid,
          quantity: qty,
          sourceWarehouseId: src,
          destinationWarehouseId: dst,
          notes: notes.trim() || null,
        });
        showSuccess('Traslado registrado correctamente');
        router.push(ROUTES.transfers.list);
      } catch (err) {
        if (isUnauthorized(err)) {
          router.push('/login');
          return;
        }
        setFormError(getApiErrorMessage(err, 'No se pudo registrar el traslado'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const costStr = String(unitCost ?? '').trim().replace(',', '.');
    const cost = parseFloat(costStr);
    if (costStr === '' || Number.isNaN(cost) || cost < 0) {
      const msg = 'Indica un costo unitario válido (≥ 0).';
      setFormError(msg);
      showError(msg);
      return;
    }

    const expRaw = String(expirationDate ?? '').trim();
    const expirationPayload = expRaw === '' ? null : expRaw;

    setSubmitting(true);
    try {
      await createInventoryMovementRequest({
        type: 'PURCHASE',
        productId: pid,
        quantity: qty,
        unitCost: cost,
        sourceWarehouseId: null,
        destinationWarehouseId: dst,
        notes: notes.trim() || null,
        expirationDate: expirationPayload,
      });
      showSuccess('Entrada por compra registrada');
      await router.push(ROUTES.transfers.list);
    } catch (err) {
      if (isUnauthorized(err)) {
        router.push('/login');
        return;
      }
      const apiMsg = getApiErrorMessage(err, 'No se pudo registrar la entrada por compra');
      setFormError(apiMsg);
      showError(apiMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-2">Nuevo movimiento</h1>
      <p className="text-sm text-gray-600 mb-6">
        Traslado entre bodegas o entrada por compra hacia una bodega (sin origen interno).
      </p>

      <div className="bg-gray-400/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)] max-w-2xl">
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('transfer');
              setFormError(null);
              setExpirationDate('');
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              mode === 'transfer'
                ? 'bg-[#001F3F] text-white border-[#001F3F]'
                : 'bg-white/60 text-gray-800 border-gray-300 hover:bg-white'
            }`}
          >
            Traslado entre bodegas
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('purchase');
              setFormError(null);
              setSourceWarehouseId('');
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              mode === 'purchase'
                ? 'bg-[#001F3F] text-white border-[#001F3F]'
                : 'bg-white/60 text-gray-800 border-gray-300 hover:bg-white'
            }`}
          >
            Entrada por compra
          </button>
        </div>

        {mode === 'transfer' ? (
          <p className="text-sm text-gray-600 mb-4">
            Debe existir cantidad suficiente en la bodega de origen.
          </p>
        ) : (
          <p className="text-sm text-gray-600 mb-4">
            Ingresa stock recibido de un proveedor u origen externo. La entrada se registra siempre en
            la <strong>bodega principal</strong> (configurada en Bodegas). El costo unitario queda en el
            movimiento (Kardex).
          </p>
        )}

        <p className="text-sm text-blue-800 mb-6">
          ¿Falta una bodega?{' '}
          <Link href={ROUTES.transfers.warehousesCreate} className="underline font-medium">
            Crear bodega
          </Link>{' '}
          (sección Bodegas).
        </p>

        {loadError && (
          <div className="p-4 mb-4 rounded-lg bg-red-100 text-red-700 border border-red-300">
            {loadError}
            <Button variant="secondary" className="mt-2" onClick={() => loadReferences()}>
              Reintentar
            </Button>
          </div>
        )}

        {loadingRefs ? (
          <div className="py-10 text-center text-gray-600">Cargando datos…</div>
        ) : (
          <form
            noValidate
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
          >
            {formError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
                {formError}
              </div>
            )}

            {mode === 'transfer' && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Bodega origen *</label>
                <select
                  className="border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#001F3F]"
                  value={sourceWarehouseId}
                  onChange={(e) => setSourceWarehouseId(e.target.value)}
                  required={mode === 'transfer'}
                >
                  <option value="">Selecciona…</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {mode === 'purchase' ? (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Bodega destino</label>
                {principalWarehouse ? (
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={principalWarehouse.name}
                    className="border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-gray-100 cursor-not-allowed"
                  />
                ) : (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    No hay bodega principal entre las bodegas activas.{' '}
                    <Link
                      href={ROUTES.transfers.warehouses}
                      className="underline font-medium text-amber-900"
                    >
                      Ir a Bodegas
                    </Link>{' '}
                    y marca una como principal, o{' '}
                    <Link
                      href={ROUTES.transfers.warehousesCreate}
                      className="underline font-medium text-amber-900"
                    >
                      crea una nueva
                    </Link>
                    .
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Bodega destino *</label>
                <select
                  className="border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#001F3F]"
                  value={destinationWarehouseId}
                  onChange={(e) => setDestinationWarehouseId(e.target.value)}
                  required
                >
                  <option value="">Selecciona…</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Producto *</label>
              <select
                className="border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#001F3F]"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                required
              >
                <option value="">Selecciona…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.internalCode} — {p.name} ({p.unitOfMeasure})
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Cantidad *"
              type="number"
              step="any"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />

            {selectedProduct && (
              <>
                <Input
                  label="Proveedor (catálogo)"
                  value={selectedProduct.supplier?.name?.trim() || '—'}
                  readOnly
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                  title="Proveedor asignado al producto en el catálogo"
                />
                <Input
                  label="Unidad de ingreso (catálogo)"
                  value={formatProductInputUnitLabel(selectedProduct.inputUnit)}
                  readOnly
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
                <Input
                  label="Cantidad por unidad ingresada (catálogo)"
                  value={String(selectedProduct.inputUnitQuantity ?? 1)}
                  readOnly
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
              </>
            )}

            {mode === 'purchase' && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Fecha de vencimiento</label>
                  <input
                    type="date"
                    className="border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#001F3F]"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                  />
                </div>
                <Input
                  label="Costo unitario *"
                  type="number"
                  step="any"
                  min="0"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  required
                />
              </>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Notas (opcional)</label>
              <textarea
                className="border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#001F3F]"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={
                  submitting || (mode === 'purchase' && !principalWarehouse)
                }
              >
                {submitting
                  ? 'Registrando…'
                  : mode === 'transfer'
                    ? 'Registrar traslado'
                    : 'Registrar entrada'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(ROUTES.transfers.list)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}
