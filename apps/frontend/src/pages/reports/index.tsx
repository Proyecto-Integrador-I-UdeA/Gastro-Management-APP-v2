'use client';

import { useState } from 'react';
import { Download, FileText, Package, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { fetchProductionCostsReport, fetchSalesReport } from '@/lib/reportsApi';
import { generateProductionCostsPdf } from '@/utils/pdf/productionCostsPdf';
import { generateSalesPdf } from '@/utils/pdf/salesPdf';
import { loadLogoAsDataUrl } from '@/utils/pdf/pdfTheme';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (d: number) => { const x = new Date(); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10); };

function getPreparedBy(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem('user') ?? localStorage.getItem('auth_user') ?? localStorage.getItem('currentUser');
    if (!raw) return undefined;
    const u = JSON.parse(raw);
    return u?.fullName ?? u?.email ?? undefined;
  } catch { return undefined; }
}

export default function ReportsPage() {
  const [prodFrom, setProdFrom] = useState(daysAgo(30));
  const [prodTo, setProdTo] = useState(today());
  const [salesFrom, setSalesFrom] = useState(daysAgo(30));
  const [salesTo, setSalesTo] = useState(today());
  const [loadingProd, setLoadingProd] = useState(false);
  const [loadingSales, setLoadingSales] = useState(false);

  const handleProd = async () => {
    if (!prodFrom || !prodTo || prodFrom > prodTo) { toast.error('Rango inválido'); return; }
    setLoadingProd(true);
    try {
      const [data, logo] = await Promise.all([
        fetchProductionCostsReport(prodFrom, prodTo),
        loadLogoAsDataUrl(),
      ]);
      generateProductionCostsPdf(data, { preparedBy: getPreparedBy(), logoDataUrl: logo });
      toast.success('Reporte descargado');
    } catch (e) { console.error(e); toast.error('No se pudo generar el reporte'); }
    finally { setLoadingProd(false); }
  };

  const handleSales = async () => {
    if (!salesFrom || !salesTo || salesFrom > salesTo) { toast.error('Rango inválido'); return; }
    setLoadingSales(true);
    try {
      const [data, logo] = await Promise.all([
        fetchSalesReport(salesFrom, salesTo),
        loadLogoAsDataUrl(),
      ]);
      generateSalesPdf(data, { preparedBy: getPreparedBy(), logoDataUrl: logo });
      toast.success('Reporte descargado');
    } catch (e) { console.error(e); toast.error('No se pudo generar el reporte'); }
    finally { setLoadingSales(false); }
  };

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold text-[#001F3F] mb-8">Reportes PDF</h1>
      <p className="mb-8 text-sm text-slate-600">Genera reportes formales en PDF con comparación de período anterior.</p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
              <Package size={20} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Producción y Costos</h2>
              <p className="text-xs text-slate-500">13 secciones: KPIs con delta, movimientos, desperdicio, stock, menú, nómina, gastos, almacenes.</p>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-slate-700">Desde
              <input type="date" value={prodFrom} max={prodTo} onChange={(e) => setProdFrom(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs font-medium text-slate-700">Hasta
              <input type="date" value={prodTo} min={prodFrom} onChange={(e) => setProdTo(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
          </div>

          <ul className="mb-5 space-y-1 text-xs text-slate-600">
            <li className="flex items-center gap-2"><FileText size={12} /> Comparación vs período anterior equivalente</li>
            <li className="flex items-center gap-2"><FileText size={12} /> Stock crítico y productos por vencer</li>
            <li className="flex items-center gap-2"><FileText size={12} /> Estructura de menú, nómina y gastos</li>
          </ul>

          <button onClick={handleProd} disabled={loadingProd}
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
            <Download size={16} /> {loadingProd ? 'Generando…' : 'Descargar PDF'}
          </button>
        </section>

        <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <TrendingUp size={20} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Ventas</h2>
              <p className="text-xs text-slate-500">13 secciones: KPIs con delta, tendencia, mix, caja, mesas, SLA, adiciones y anulaciones.</p>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-slate-700">Desde
              <input type="date" value={salesFrom} max={salesTo} onChange={(e) => setSalesFrom(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs font-medium text-slate-700">Hasta
              <input type="date" value={salesTo} min={salesFrom} onChange={(e) => setSalesTo(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
            </label>
          </div>

          <ul className="mb-5 space-y-1 text-xs text-slate-600">
            <li className="flex items-center gap-2"><FileText size={12} /> Comparación vs período anterior equivalente</li>
            <li className="flex items-center gap-2"><FileText size={12} /> Cuadre de caja y anulaciones</li>
            <li className="flex items-center gap-2"><FileText size={12} /> Adiciones vendidas y SLA de cocina</li>
          </ul>

          <button onClick={handleSales} disabled={loadingSales}
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
            <Download size={16} /> {loadingSales ? 'Generando…' : 'Descargar PDF'}
          </button>
        </section>
      </div>
    </DashboardLayout>
  );
}