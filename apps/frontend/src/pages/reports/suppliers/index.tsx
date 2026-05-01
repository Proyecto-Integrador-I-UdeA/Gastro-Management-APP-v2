'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Badge,
  BarChart,
  BarList,
  Card,
  DonutChart,
  Metric,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Text,
  Title,
  TextInput,
} from '@tremor/react';
import type { CustomTooltipProps } from '@tremor/react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { ROUTES } from '@/constants/routes';
import { fetchSuppliersCatalogReport } from '@/lib/reportsApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import type { SupplierCatalogRow } from '@/types/reports';

const ni = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

const kpiMetricClass =
  '!text-4xl sm:!text-5xl tabular-nums tracking-tight text-slate-900';

function TopSuppliersActiveTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as
    | { nombre?: string; 'Prod. activos'?: number }
    | undefined;
  if (!row) return null;
  const count = row['Prod. activos'];
  return (
    <div className="rounded-tremor-default border border-tremor-border bg-tremor-background px-3 py-2 text-tremor-default shadow-tremor-dropdown">
      <p className="font-medium text-tremor-content-emphasis">{row.nombre ?? '—'}</p>
      <p className="mt-1 text-sm text-tremor-content">
        Prod. activos: {ni.format(count ?? 0)}
      </p>
    </div>
  );
}

export default function ReportsSuppliersCatalogPage() {
  useAuthGuard('reports.read');

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SupplierCatalogRow[]>([]);
  const [kpis, setKpis] = useState<{
    totalSuppliers: number;
    activeSuppliers: number;
    inactiveSuppliers: number;
    activeWithNoActiveProducts: number;
  } | null>(null);
  const [topByActive, setTopByActive] = useState<SupplierCatalogRow[]>([]);
  const [noActiveProducts, setNoActiveProducts] = useState<SupplierCatalogRow[]>([]);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSuppliersCatalogReport();
      setKpis(data.kpis);
      setRows(data.rows);
      setTopByActive(data.rankings.topByActiveProducts);
      setNoActiveProducts(data.rankings.noActiveProducts);
    } catch (e) {
      if (isUnauthorized(e)) {
        void router.push('/login');
        return;
      }
      setError(getApiErrorMessage(e, 'No se pudo cargar el reporte'));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const code = r.internalCode?.toLowerCase() ?? '';
      const name = r.name?.toLowerCase() ?? '';
      const tax = r.taxId?.toLowerCase() ?? '';
      return code.includes(q) || name.includes(q) || tax.includes(q);
    });
  }, [rows, search]);

  const barTop = useMemo(
    () =>
      topByActive.map((r) => ({
        name: `${r.internalCode} · ${r.name}`.slice(0, 56),
        value: r.activeProductCount,
      })),
    [topByActive]
  );

  const catalogDonutData = useMemo(() => {
    if (!kpis) return [];
    const activeWithProducts = Math.max(
      0,
      kpis.activeSuppliers - kpis.activeWithNoActiveProducts
    );
    return [
      { name: 'Inactivos', value: kpis.inactiveSuppliers },
      { name: 'Activos sin producto', value: kpis.activeWithNoActiveProducts },
      { name: 'Activos con productos activos', value: activeWithProducts },
    ];
  }, [kpis]);

  const topActiveBarChartData = useMemo(
    () =>
      topByActive.map((r) => ({
        proveedor: `${r.internalCode}`.slice(0, 18),
        nombre: r.name,
        'Prod. activos': r.activeProductCount,
      })),
    [topByActive]
  );

  return (
    <DashboardLayout>
      <div className="min-w-0 space-y-8">
          <div>
            <Title className="text-[#001F3F]">Reportes · Proveedores</Title>
            <Text className="mt-1">
              Catálogo y concentración de productos activos por proveedor (sin datos de compras).
            </Text>
          </div>

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
                  <Text>Proveedores en catálogo</Text>
                  <Metric className={kpiMetricClass}>{ni.format(kpis.totalSuppliers)}</Metric>
                </Card>
                <Card decoration="top" decorationColor="emerald">
                  <Text>Proveedores activos</Text>
                  <Metric className={kpiMetricClass}>{ni.format(kpis.activeSuppliers)}</Metric>
                </Card>
                <Card decoration="top" decorationColor="gray">
                  <Text>Proveedores inactivos</Text>
                  <Metric className={kpiMetricClass}>{ni.format(kpis.inactiveSuppliers)}</Metric>
                </Card>
                <Card decoration="top" decorationColor="amber">
                  <Text>Activos sin producto</Text>
                  <Metric className={kpiMetricClass}>
                    {ni.format(kpis.activeWithNoActiveProducts)}
                  </Metric>
                  <Text className="text-xs text-gray-500 mt-1">
                    Proveedor activo sin ningún producto asignado
                  </Text>
                </Card>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card>
                  <Title className="text-base">Composición del catálogo</Title>
                  <Text className="text-sm mt-1">
                    Mismo total que «Proveedores en catálogo» ({kpis.totalSuppliers}): inactivos,
                    activos sin ningún producto, y activos con al menos un producto activo.
                  </Text>
                  {catalogDonutData.every((d) => d.value === 0) ? (
                    <Text className="mt-6">Sin datos.</Text>
                  ) : (
                    <DonutChart
                      className="mt-4 h-56"
                      data={catalogDonutData}
                      category="value"
                      index="name"
                      colors={['gray', 'amber', 'emerald']}
                      valueFormatter={(v) => ni.format(v)}
                      showLabel={true}
                    />
                  )}
                </Card>
                <Card>
                  <Title className="text-base">Top 10 por productos activos</Title>
                  <Text className="text-sm mt-1">
                    Proveedores con al menos un producto activo (mismo criterio que la lista
                    inferior).
                  </Text>
                  {topActiveBarChartData.length === 0 ? (
                    <Text className="mt-6">Ningún proveedor con productos activos.</Text>
                  ) : (
                    <BarChart
                      className="mt-4 h-80"
                      data={topActiveBarChartData}
                      index="proveedor"
                      categories={['Prod. activos']}
                      colors={['cyan']}
                      layout="horizontal"
                      yAxisWidth={72}
                      valueFormatter={(v) => ni.format(v)}
                      customTooltip={TopSuppliersActiveTooltip}
                      showLegend={false}
                    />
                  )}
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <Title className="text-base">Top por productos activos</Title>
                  <Text className="text-sm mt-1">
                    Proveedores con al menos un producto activo, ordenados por volumen.
                  </Text>
                  {barTop.length === 0 ? (
                    <Text className="mt-4">Ningún proveedor con productos activos.</Text>
                  ) : (
                    <BarList
                      data={barTop}
                      className="mt-4"
                      valueFormatter={(v) => ni.format(v)}
                    />
                  )}
                </Card>
                <Card>
                  <Title className="text-base">Activos sin producto</Title>
                  <Text className="text-sm mt-1">
                    Conviene asignar productos o marcar el proveedor inactivo si no aplica.
                  </Text>
                  {noActiveProducts.length === 0 ? (
                    <Text className="mt-4">Todos los proveedores activos tienen al menos un producto activo.</Text>
                  ) : (
                    <div className="overflow-x-auto max-h-[280px] overflow-y-auto mt-4">
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableHeaderCell>Código</TableHeaderCell>
                            <TableHeaderCell>Nombre</TableHeaderCell>
                            <TableHeaderCell></TableHeaderCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {noActiveProducts.map((r) => (
                            <TableRow key={r.supplierId}>
                              <TableCell className="font-mono text-sm">
                                {r.internalCode}
                              </TableCell>
                              <TableCell className="text-sm">{r.name}</TableCell>
                              <TableCell>
                                <Link
                                  href={ROUTES.suppliers.edit(r.supplierId)}
                                  className="text-sm text-blue-700 hover:underline whitespace-nowrap"
                                >
                                  Editar
                                </Link>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </Card>
              </div>

              <Card>
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4">
                  <div>
                    <Title className="text-base">Detalle por proveedor</Title>
                    <Text className="text-sm">
                      Productos activos y total histórico (activos + inactivos)
                    </Text>
                  </div>
                  <div className="max-w-xs w-full">
                    <TextInput
                      placeholder="Buscar código, nombre o NIT…"
                      value={search}
                      onValueChange={setSearch}
                    />
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Código</TableHeaderCell>
                        <TableHeaderCell>Proveedor</TableHeaderCell>
                        <TableHeaderCell>NIT / RUT</TableHeaderCell>
                        <TableHeaderCell>Estado</TableHeaderCell>
                        <TableHeaderCell className="text-right">Prod. activos</TableHeaderCell>
                        <TableHeaderCell className="text-right">Prod. total</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredRows.map((r) => (
                        <TableRow key={r.supplierId}>
                          <TableCell className="font-mono text-sm">
                            {r.internalCode}
                          </TableCell>
                          <TableCell className="font-medium text-gray-900">{r.name}</TableCell>
                          <TableCell className="text-sm text-gray-700">{r.taxId}</TableCell>
                          <TableCell>
                            <Badge color={r.active ? 'emerald' : 'gray'}>
                              {r.active ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {ni.format(r.activeProductCount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-gray-600">
                            {ni.format(r.totalProductCount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          ) : null}
      </div>
    </DashboardLayout>
  );
}
