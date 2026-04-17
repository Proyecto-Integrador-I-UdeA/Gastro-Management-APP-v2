'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Badge,
  BarList,
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
  TextInput,
} from '@tremor/react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { ROUTES } from '@/constants/routes';
import { fetchProductsInventoryRisk } from '@/lib/reportsApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import type { InventoryRiskLevel, ProductInventoryRiskRow } from '@/types/reports';

const nf = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

function riskLabel(risk: InventoryRiskLevel): string {
  switch (risk) {
    case 'zero':
      return 'Sin stock';
    case 'low':
      return 'Bajo mínimo';
    case 'high':
      return 'Sobre máximo';
    default:
      return 'OK';
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

  const barCritical = useMemo(
    () =>
      criticalLow.map((r) => ({
        name: `${r.internalCode} · ${r.name}`.slice(0, 56),
        value: r.deficitBelowMin ?? 0,
      })),
    [criticalLow]
  );

  const barExcess = useMemo(
    () =>
      highExcess.map((r) => ({
        name: `${r.internalCode} · ${r.name}`.slice(0, 56),
        value: r.excessAboveMax ?? 0,
      })),
    [highExcess]
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
                <Card decoration="top" decorationColor="slate">
                  <Text>Productos activos</Text>
                  <Metric>{nf.format(kpis.totalActiveProducts)}</Metric>
                </Card>
                <Card decoration="top" decorationColor="red">
                  <Text>Sin stock</Text>
                  <Metric>{nf.format(kpis.zeroStock)}</Metric>
                </Card>
                <Card decoration="top" decorationColor="amber">
                  <Text>Bajo mínimo (&gt;0)</Text>
                  <Metric>{nf.format(kpis.lowStock)}</Metric>
                </Card>
                <Card decoration="top" decorationColor="orange">
                  <Text>Sobre máximo</Text>
                  <Metric>{nf.format(kpis.highStock)}</Metric>
                </Card>
                <Card decoration="top" decorationColor="emerald">
                  <Text>En rango OK</Text>
                  <Metric>{nf.format(kpis.okStock)}</Metric>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <Title className="text-base">Mayor déficit vs mínimo</Title>
                  <Text className="text-sm mt-1">
                    Incluye sin stock (déficit = mínimo − existencia).
                  </Text>
                  {barCritical.length === 0 ? (
                    <Text className="mt-4">Ningún producto bajo el mínimo.</Text>
                  ) : (
                    <BarList
                      data={barCritical}
                      className="mt-4"
                      valueFormatter={(v) => nf.format(v)}
                    />
                  )}
                </Card>
                <Card>
                  <Title className="text-base">Mayor exceso vs máximo</Title>
                  <Text className="text-sm mt-1">
                    Solo si el producto tiene máximo &gt; 0 en catálogo.
                  </Text>
                  {barExcess.length === 0 ? (
                    <Text className="mt-4">Ningún producto sobre el máximo.</Text>
                  ) : (
                    <BarList
                      data={barExcess}
                      className="mt-4"
                      valueFormatter={(v) => nf.format(v)}
                    />
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
                        <TableHeaderCell className="text-right">Stock</TableHeaderCell>
                        <TableHeaderCell className="text-right">Mín</TableHeaderCell>
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
                          <TableCell className="text-right tabular-nums">
                            {nf.format(r.totalQuantity)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-gray-600">
                            {nf.format(r.minStock)}
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
