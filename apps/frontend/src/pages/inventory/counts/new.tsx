import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import PhysicalCountEditor, { invalidCountLines } from '@/components/inventory/PhysicalCountEditor';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { createPhysicalCount, fetchCountReferences, type CountLineInput } from '@/lib/inventoryPhysicalCountsApi';
import type { CountReferences, PhysicalCountReason } from '@/types/inventoryPhysicalCount';

export default function NewPhysicalCountPage() {
  useAuthGuard('inventory.create');
  const router = useRouter();
  const [refs, setRefs] = useState<CountReferences>({ warehouses: [], products: [] });
  const [warehouseId, setWarehouseId] = useState(0);
  const [lines, setLines] = useState<CountLineInput[]>([]);
  const [reason, setReason] = useState<PhysicalCountReason>('PHYSICAL_COUNT');
  const [notes, setNotes] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { void fetchCountReferences().then(data => { setRefs(data); const mains = data.warehouses.filter(w => w.isMain); if (mains.length === 1) setWarehouseId(mains[0].id); }); }, []);
  useEffect(() => { if (warehouseId) void fetchCountReferences(warehouseId).then(setRefs); }, [warehouseId]);
  async function save() { if (!warehouseId) return setError('Selecciona una bodega activa.'); if (invalidCountLines(lines)) return setError('Corrige las cantidades físicas inválidas.'); setBusy(true); setError(''); try { const count = await createPhysicalCount({ warehouseId, reason, notes: notes || null, items: lines }); await router.push(`/inventory/counts/${count.id}`); } catch (e) { setError(e instanceof Error ? e.message : 'No fue posible guardar el borrador'); } finally { setBusy(false); } }
  return <DashboardLayout><h1 className="text-3xl font-bold text-[#001F3F]">Nuevo conteo físico</h1><div className="mt-5 rounded-2xl bg-white p-6 shadow"><PhysicalCountEditor references={refs} warehouseId={warehouseId} lines={lines} reason={reason} notes={notes} onWarehouse={id => { setWarehouseId(id); setLines([]); }} onLines={setLines} onReason={setReason} onNotes={setNotes} />{error && <p role="alert" className="mt-4 text-red-700">{error}</p>}<button type="button" disabled={busy} onClick={() => void save()} className="mt-5 rounded-lg bg-[#001F3F] px-5 py-2 font-semibold text-white disabled:opacity-50">Guardar borrador</button></div></DashboardLayout>;
}
