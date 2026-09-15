import Link from 'next/link';
import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { fetchPhysicalCounts } from '@/lib/inventoryPhysicalCountsApi';
import type { PhysicalCount } from '@/types/inventoryPhysicalCount';

const statusLabel = { DRAFT: 'Borrador', POSTED: 'Publicado', CANCELLED: 'Cancelado' } as const;

export default function PhysicalCountsPage() {
  useAuthGuard('inventory.read');
  const [counts, setCounts] = useState<PhysicalCount[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { void fetchPhysicalCounts().then(setCounts).catch(error => setError(error instanceof Error ? error.message : 'No fue posible cargar los conteos')); }, []);
  return <DashboardLayout>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-3xl font-bold text-[#001F3F]">Conteos físicos</h1><p className="mt-1 text-gray-600">Histórico de conciliaciones por bodega.</p></div>
      <Link href="/inventory/counts/new" className="rounded-lg bg-[#001F3F] px-4 py-2 font-semibold text-white">Nuevo conteo</Link>
    </div>
    {error && <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}
    <div className="mt-6 overflow-x-auto rounded-2xl bg-white p-5 shadow">
      <table className="min-w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Documento</th><th>Bodega</th><th>Fecha</th><th>Responsable</th><th>Estado</th><th /></tr></thead>
        <tbody>{counts.map(count => <tr key={count.id} className="border-b"><td className="p-2 font-semibold">#{count.id}</td><td>{count.warehouse.name}</td><td>{new Date(count.createdAt).toLocaleString('es-CO')}</td><td>{count.createdBy.fullName ?? count.createdBy.email}</td><td>{statusLabel[count.status]}</td><td><Link className="text-blue-700 underline" href={`/inventory/counts/${count.id}`}>Ver detalle</Link></td></tr>)}</tbody>
      </table>{counts.length === 0 && !error && <p className="py-8 text-center text-gray-500">No hay conteos físicos.</p>}
    </div>
  </DashboardLayout>;
}
