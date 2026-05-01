'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  BarChart,
  Card,
  Metric,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Text,
  Title,
} from '@tremor/react';
import type { CustomTooltipProps } from '@tremor/react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { fetchTransfersReportSummary } from '@/lib/reportsApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { useAuthGuard } from '@/hooks/useAuthGuard';

const nf = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
const ni = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

const kpiMetricClass =
  '!text-4xl sm:!text-5xl tabular-nums tracking-tight text-slate-900';

function TopTransferVolumeTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { nombre?: string; Volumen?: number } | undefined;
  if (!row) return null;
  return (
    <div className="rounded-tremor-default border border-tremor-border bg-tremor-background px-3 py-2 text-tremor-default shadow-tremor-dropdown">
      <p className="font-medium text-tremor-content-emphasis">{row.nombre ?? '—'}</p>
      <p className="mt-1 text-sm text-tremor-content">
        Volumen: {nf.format(row.Volumen ?? 0)}
      </p>
    </div>
  );
}

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultToYmd(): string {
  return localYmd(new Date());
}

function defaultFromYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return localYmd(d);
}

export default function ReportsTransfersPage() {
  useAuthGuard('reports.read');

  const router = useRouter();
  const [fromYmd, setFromYmd] = useState(defaultFromYmd);
  const [toYmd, setToYmd] = useState(defaultToYmd);
  const [appliedFrom, setAppliedFrom] = useState(defaultFromYmd);
  const [appliedTo, setAppliedTo] = useState(defaultToYmd);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<{
    movementCount: number;
    totalQuantity: number;
    distinctProducts: number;
    distinctWarehouses: number;
  } | null>(null);
  const [timeSeries, setTimeSeries] = useState<
    { day: string; movementCount: number; totalQuantity: number }[]
  >([]);
  const [topProducts, setTopProducts] = useState<
    {
      productId: number;
      internalCode: string;
      name: string;
      unitOfMeasure: string;
      totalQuantity: number;
    }[]
  >([]);
  const [routes, setRoutes] = useState<
    {
      sourceWarehouseName: string;
      destinationWarehouseName: string;
      movementCount: number;
      totalQuantity: number;
    }[]
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTransfersReportSummary({
        from: appliedFrom,
        to: appliedTo,
      });
      setKpis(data.kpis);
      setTimeSeries(data.timeSeries);
      setTopProducts(data.topProducts);
      setRoutes(data.routes);
    } catch (e) {
      if (isUnauthorized(e)) {
        void router.push('/login');
        return;
      }
      setError(getApiErrorMessage(e, 'No se pudo cargar el reporte'));
    } finally {
      setLoading(false);
    }
  }, [router, appliedFrom, appliedTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyRange = () => {
    if (fromYmd > toYmd) {
      setError('La fecha inicial no puede ser posterior a la final.');
      return;
    }
    setError(null);
    setAppliedFrom(fromYmd);
    setAppliedTo(toYmd);
  };

  const chartSeries = useMemo(
    () =>
      timeSeries.map((p) => ({
        día: p.day,
        Cantidad: p.totalQuantity,
        Movimientos: p.movementCount,
      })),
    [timeSeries]
  );

  const topProductsChartData = useMemo(
    () =>
      topProducts.slice(0, 5).map((r) => ({
        producto: `${r.internalCode}`.slice(0, 16),
        nombre: r.name,
        Volumen: r.totalQuantity,
      })),
    [topProducts]
  );

  return (
    <DashboardLayout>
      <div className="min-w-0 space-y-8">
        <div>
          <Title className="text-[#001F3F]">Reportes · Traslados</Title>
          <Text className="mt-1">
            Movimientos tipo transferencia entre bodegas: volumen y rutas frecuentes en el rango
            elegido.
          </Text>
        </div>

        <Card>
          <div className="flex flex-col lg:flex-row lg:items-end gap-4 flex-wrap">
            <div>
              <Text className="text-xs text-gray-500">Desde</Text>
              <input
                type="date"
                value={fromYmd}
                onChange={(e) => setFromYmd(e.target.value)}
                className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <Text className="text-xs text-gray-500">Hasta</Text>
              <input
                type="date"
                value={toYmd}
                onChange={(e) => setToYmd(e.target.value)}
                className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={() => applyRange()}
              className="rounded-md bg-[#001F3F] px-4 py-2 text-sm font-medium text-white hover:bg-[#003366]"
            >
              Actualizar
            </button>
          </div>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <Text>Cargando datos…</Text>
        ) : kpis ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <Card decoration="top" decorationColor="slate">
                <Text>Traslados (movimientos)</Text>
                <Metric className={kpiMetricClass}>{ni.format(kpis.movementCount)}</Metric>
              </Card>
              <Card decoration="top" decorationColor="cyan">
                <Text>Cantidad total movida</Text>
                <Metric className={kpiMetricClass}>{nf.format(kpis.totalQuantity)}</Metric>
              </Card>
              <Card decoration="top" decorationColor="indigo">
                <Text>Productos distintos</Text>
                <Metric className={kpiMetricClass}>{ni.format(kpis.distinctProducts)}</Metric>
              </Card>
              <Card decoration="top" decorationColor="violet">
                <Text>Bodegas involucradas</Text>
                <Metric className={kpiMetricClass}>{ni.format(kpis.distinctWarehouses)}</Metric>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card>
                <Title className="text-base">Serie temporal</Title>
                <Text className="text-sm mt-1">
                  Cantidad trasladada por día (suma de unidades en el periodo).
                </Text>
                {chartSeries.length === 0 ? (
                  <Text className="mt-6">Sin traslados en este rango.</Text>
                ) : (
                  <BarChart
                    className="mt-4 h-72"
                    data={chartSeries}
                    index="día"
                    categories={['Cantidad']}
                    colors={['cyan']}
                    valueFormatter={(v) => nf.format(v)}
                  />
                )}
              </Card>
              <Card>
                <Title className="text-base">Top 5 productos por volumen</Title>
                <Text className="text-sm mt-1">Suma de cantidades transferidas en el periodo.</Text>
                {topProductsChartData.length === 0 ? (
                  <Text className="mt-6">Sin datos.</Text>
                ) : (
                  <BarChart
                    className="mt-4 h-72"
                    data={topProductsChartData}
                    index="producto"
                    categories={['Volumen']}
                    colors={['indigo']}
                    layout="horizontal"
                    yAxisWidth={88}
                    valueFormatter={(v) => nf.format(v)}
                    customTooltip={TopTransferVolumeTooltip}
                    showLegend={false}
                  />
                )}
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card>
                <Title className="text-base">Rutas origen → destino</Title>
                <Text className="text-sm mt-1">Por cantidad total movida en el periodo.</Text>
                {routes.length === 0 ? (
                  <Text className="mt-4">Sin rutas en el periodo.</Text>
                ) : (
                  <Table className="mt-4">
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Origen → destino</TableHeaderCell>
                        <TableHeaderCell className="text-right whitespace-nowrap w-28">
                          Cantidad
                        </TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {routes.map((r, i) => (
                        <TableRow
                          key={`${r.sourceWarehouseName}-${r.destinationWarehouseName}-${i}`}
                        >
                          <TableCell className="text-sm pr-4">
                            {r.sourceWarehouseName} → {r.destinationWarehouseName}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm whitespace-nowrap">
                            {nf.format(r.totalQuantity)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
