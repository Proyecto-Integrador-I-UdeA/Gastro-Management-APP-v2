'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Badge,
  BarChart,
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
import { fetchProductsInventoryRisk } from '@/lib/reportsApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import type { InventoryRiskLevel, ProductInventoryRiskRow } from '@/types/reports';

const nf = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
const ni = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

const kpiCardClass = 'flex flex-col items-center text-center';
const kpiMetricClass =
  'w-full text-center block !text-4xl sm:!text-5xl tabular-nums tracking-tight text-slate-900';

function TopStockTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { nombre?: string; Existencia?: number } | undefined;
  if (!row) return null;
  return (
    <div className="rounded-tremor-default border border-tremor-border bg-tremor-background px-3 py-2 text-tremor-default shadow-tremor-dropdown">
      <p className="font-medium text-tremor-content-emphasis">{row.nombre ?? '—'}</p>
      <p className="mt-1 text-sm text-tremor-content">
        Existencia: {nf.format(row.Existencia ?? 0)}
      </p>
    </div>
  );
}

function riskLabel(risk: InventoryRiskLevel): string {
  switch (risk) {
    case 'zero':
      return 'Sin inventario';
    case 'low':
      return 'Por debajo del stock mínimo';
    case 'high':
      return 'Por encima del stock máximo';
    default:
      return 'En rango de stock';
  }
}

function riskBadgeColor(
  risk: InventoryRiskLevel
): 'red' | 'amber' | 'orange' | 'emerald' {
  switch (risk) {
    case 'zero':
      return 'red';
    case 'low':
      return 'amber';
    case 'high':
      return 'orange';
    default:
      return 'emerald';
  }
}

export default function ReportsProductsInventoryPage() {
  useAuthGuard('reports.read');

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ProductInventoryRiskRow[]>([]);
  const [kpis, setKpis] = useState<{
    totalActiveProducts: number;
    zeroStock: number;
    lowStock: number;
    highStock: number;
    okStock: number;
  } | null>(null);
  const [criticalLow, setCriticalLow] = useState<ProductInventoryRiskRow[]>([]);
  const [highExcess, setHighExcess] = useState<ProductInventoryRiskRow[]>([]);
  const [topByTotalStock, setTopByTotalStock] = useState<ProductInventoryRiskRow[]>([]);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProductsInventoryRisk();
      setKpis(data.kpis);
      setRows(data.rows);
      setCriticalLow(data.rankings.criticalLow);
      setHighExcess(data.rankings.highExcess);
      setTopByTotalStock(data.rankings.topByTotalStock ?? []);
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
      const sup = r.supplierName?.toLowerCase() ?? '';
      return code.includes(q) || name.includes(q) || sup.includes(q);
    });
  }, [rows, search]);

  const riskDonutData = useMemo(() => {
    if (!kpis) return [];
    return [
      { name: 'Sin inventario', value: kpis.zeroStock },
      { name: 'Por debajo del stock mínimo', value: kpis.lowStock },
      { name: 'Por encima del stock máximo', value: kpis.highStock },
      { name: 'En rango de stock', value: kpis.okStock },
    ];
  }, [kpis]);

  const topStockChartData = useMemo(
    () =>
      topByTotalStock.map((r) => ({
        producto: `${r.internalCode}`.slice(0, 18),
        nombre: r.name,
        Existencia: r.totalQuantity,
      })),
    [topByTotalStock]
  );

  return (
    <DashboardLayout>
      <div className="min-w-0 space-y-8">
          <div>
            <Title className="text-[#001F3F]">Reportes · Productos</Title>
            <Text className="mt-1">
              Inventario agregado (todas las bodegas) frente a mínimo y máximo del catálogo.
              Solo productos activos.
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
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                <Card className={kpiCardClass} decoration="top" decorationColor="slate">
                  <Text className="font-bold">Productos activos</Text>
                  <Metric className={kpiMetricClass}>{nf.format(kpis.totalActiveProducts)}</Metric>
                </Card>
                <Card className={kpiCardClass} decoration="top" decorationColor="red">
                  <Text className="font-bold">Sin inventario</Text>
                  <Metric className={kpiMetricClass}>{nf.format(kpis.zeroStock)}</Metric>
                </Card>
                <Card className={kpiCardClass} decoration="top" decorationColor="amber">
                  <Text className="font-bold">Por debajo del stock mínimo</Text>
                  <Metric className={kpiMetricClass}>{nf.format(kpis.lowStock)}</Metric>
                </Card>
                <Card className={kpiCardClass} decoration="top" decorationColor="orange">
                  <Text className="font-bold">Por encima del stock máximo</Text>
                  <Metric className={kpiMetricClass}>{nf.format(kpis.highStock)}</Metric>
                </Card>
                <Card className={kpiCardClass} decoration="top" decorationColor="emerald">
                  <Text className="font-bold">En rango de stock</Text>
                  <Metric className={kpiMetricClass}>{nf.format(kpis.okStock)}</Metric>
                </Card>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card>
                  <Title className="text-base">Distribución de riesgo</Title>
                  <Text className="text-sm mt-1">
                    Productos activos clasificados por umbrales de inventario.
                  </Text>
                  {riskDonutData.every((d) => d.value === 0) ? (
                    <Text className="mt-6">Sin datos.</Text>
                  ) : (
                    <DonutChart
                      className="mt-4 h-56"
                      data={riskDonutData}
                      category="value"
                      index="name"
                      colors={['red', 'amber', 'orange', 'emerald']}
                      valueFormatter={(v) => ni.format(v)}
                      showLabel={true}
                    />
                  )}
                </Card>
                <Card>
                  <Title className="text-base">Top 10 por stock total</Title>
                  {topStockChartData.length === 0 ? (
                    <Text className="mt-6">Sin productos.</Text>
                  ) : (
                    <BarChart
                      className="mt-4 h-80"
                      data={topStockChartData}
                      index="producto"
                      categories={['Existencia']}
                      colors={['cyan']}
                      layout="horizontal"
                      yAxisWidth={72}
                      valueFormatter={(v) => nf.format(v)}
                      customTooltip={TopStockTooltip}
                      showLegend={false}
                    />
                  )}
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <Title className="text-base">Mayor faltante frente al stock mínimo</Title>
                  {criticalLow.length === 0 ? (
                    <Text className="mt-4">Ningún producto por debajo del stock mínimo.</Text>
                  ) : (
                    <div className="overflow-x-auto max-h-[320px] overflow-y-auto mt-4">
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableHeaderCell>Producto</TableHeaderCell>
                            <TableHeaderCell className="text-right whitespace-nowrap">
                              Stock mínimo
                            </TableHeaderCell>
                            <TableHeaderCell className="text-right whitespace-nowrap">
                              Stock actual
                            </TableHeaderCell>
                            <TableHeaderCell className="text-right whitespace-nowrap">
                              Déficit
                            </TableHeaderCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {criticalLow.map((r) => (
                            <TableRow key={r.productId}>
                              <TableCell className="text-sm">
                                <span className="font-mono">{r.internalCode}</span>
                                <Text className="text-xs text-gray-600">{r.name}</Text>
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm text-gray-700">
                                {nf.format(r.minStock)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {nf.format(r.totalQuantity)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {nf.format(r.deficitBelowMin ?? 0)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </Card>
                <Card>
                  <Title className="text-base">Mayor exceso sobre el stock máximo</Title>
                  {highExcess.length === 0 ? (
                    <Text className="mt-4">Ningún producto por encima del stock máximo.</Text>
                  ) : (
                    <div className="overflow-x-auto max-h-[320px] overflow-y-auto mt-4">
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableHeaderCell>Producto</TableHeaderCell>
                            <TableHeaderCell className="text-right whitespace-nowrap">
                              Stock máximo
                            </TableHeaderCell>
                            <TableHeaderCell className="text-right whitespace-nowrap">
                              Stock actual
                            </TableHeaderCell>
                            <TableHeaderCell className="text-right whitespace-nowrap">
                              Exceso
                            </TableHeaderCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {highExcess.map((r) => (
                            <TableRow key={r.productId}>
                              <TableCell className="text-sm">
                                <span className="font-mono">{r.internalCode}</span>
                                <Text className="text-xs text-gray-600">{r.name}</Text>
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm text-gray-700">
                                {nf.format(r.maxStock)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {nf.format(r.totalQuantity)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {nf.format(r.excessAboveMax ?? 0)}
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
                    <Title className="text-base">Detalle por producto</Title>
                    <Text className="text-sm">Existencia total vs umbrales</Text>
                  </div>
                  <div className="max-w-xs w-full">
                    <TextInput
                      placeholder="Buscar código, nombre o proveedor…"
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
                        <TableHeaderCell>Producto</TableHeaderCell>
                        <TableHeaderCell>Proveedor</TableHeaderCell>
                        <TableHeaderCell className="text-right">Mín</TableHeaderCell>
                        <TableHeaderCell className="text-right">Stock</TableHeaderCell>
                        <TableHeaderCell className="text-right">Máx</TableHeaderCell>
                        <TableHeaderCell>Riesgo</TableHeaderCell>
                        <TableHeaderCell></TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredRows.map((r) => (
                        <TableRow key={r.productId}>
                          <TableCell className="font-mono text-sm">
                            {r.internalCode}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-gray-900">{r.name}</span>
                            <Text className="text-xs text-gray-500">{r.unitOfMeasure}</Text>
                          </TableCell>
                          <TableCell className="text-sm text-gray-700">
                            {r.supplierName}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-gray-600">
                            {nf.format(r.minStock)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {nf.format(r.totalQuantity)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-gray-600">
                            {r.maxStock > 0 ? nf.format(r.maxStock) : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge color={riskBadgeColor(r.risk)}>{riskLabel(r.risk)}</Badge>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={ROUTES.products.edit(r.productId)}
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
              </Card>
            </>
          ) : null}
      </div>
    </DashboardLayout>
  );
}
