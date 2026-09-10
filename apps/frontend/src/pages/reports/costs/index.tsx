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
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
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
import { fetchCostsReport } from '@/lib/reportsApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import type {
  CostsMenuRow,
  CostsRecipeRow,
  CostsReportResponse,
} from '@/types/reports';

const nf = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });
const ni = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const kpiCardClass = 'flex flex-col items-center text-center';
const kpiMetricClass =
  'w-full text-center block !text-4xl sm:!text-5xl tabular-nums tracking-tight text-slate-900';

const MONTH_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

function formatMonthAxisLabel(month: string, createdAt: string, index: number): string {
  const m = month?.trim() ?? '';
  if (/^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split('-');
    return `${MONTH_SHORT[Number(mo) - 1]} ${y}`;
  }
  if (m) return m.slice(0, 14);
  const d = new Date(createdAt);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
  }
  return `Config ${index + 1}`;
}

/** Formato corto para ejes: evita que `$ 1.200.000` se recorte a `00.000`. */
function formatCompactCop(v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1_000_000) return `$${nf.format(v / 1_000_000)}M`;
  if (Math.abs(v) >= 1_000) return `$${nf.format(v / 1_000)}k`;
  return `$${ni.format(v)}`;
}

function MenuCostTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { nombre?: string; 'Costo total'?: number } | undefined;
  if (!row) return null;
  return (
    <div className="rounded-tremor-default border border-tremor-border bg-tremor-background px-3 py-2 text-tremor-default shadow-tremor-dropdown">
      <p className="font-medium text-tremor-content-emphasis">{row.nombre ?? '—'}</p>
      <p className="mt-1 text-sm text-tremor-content">
        Costo total: {currency.format(row['Costo total'] ?? 0)}
      </p>
    </div>
  );
}

function OverheadHistoryTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as
    | { mes?: string; Total?: number; totalLabel?: string }
    | undefined;
  if (!row) return null;
  return (
    <div className="rounded-tremor-default border border-tremor-border bg-tremor-background px-3 py-2 text-tremor-default shadow-tremor-dropdown">
      <p className="font-medium text-tremor-content-emphasis">{row.mes ?? '—'}</p>
      <p className="mt-1 text-sm text-tremor-content">
        Total: {row.totalLabel ?? currency.format(row.Total ?? 0)}
      </p>
    </div>
  );
}

export default function ReportsCostsPage() {
  useAuthGuard('reports.read');

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<CostsReportResponse['kpis'] | null>(null);
  const [operationalBreakdown, setOperationalBreakdown] = useState<
    { name: string; value: number }[]
  >([]);
  const [operationalHistory, setOperationalHistory] = useState<
    CostsReportResponse['operational']['history']
  >([]);
  const [menuItems, setMenuItems] = useState<CostsMenuRow[]>([]);
  const [recipes, setRecipes] = useState<CostsRecipeRow[]>([]);
  const [topExpensiveMenu, setTopExpensiveMenu] = useState<CostsMenuRow[]>([]);
  const [topExpensiveRecipes, setTopExpensiveRecipes] = useState<CostsRecipeRow[]>([]);
  const [zeroCostMenu, setZeroCostMenu] = useState<CostsMenuRow[]>([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [recipeSearch, setRecipeSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCostsReport();
      setKpis(data.kpis);
      setOperationalBreakdown(data.operational.breakdown);
      setOperationalHistory(data.operational.history);
      setMenuItems(data.menuItems);
      setRecipes(data.recipes);
      setTopExpensiveMenu(data.rankings.topExpensiveMenu);
      setTopExpensiveRecipes(data.rankings.topExpensiveRecipes);
      setZeroCostMenu(data.rankings.zeroCostMenu);
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

  const operationalDonut = useMemo(
    () => operationalBreakdown.map((d) => ({ name: d.name, value: d.value })),
    [operationalBreakdown]
  );

  const historyChartData = useMemo(() => {
    const chronological = [...operationalHistory].reverse().slice(-6);
    const labelCount = new Map<string, number>();

    return chronological.map((h, index) => {
      let label = formatMonthAxisLabel(h.month, h.createdAt, index);
      const seen = labelCount.get(label) ?? 0;
      labelCount.set(label, seen + 1);
      if (seen > 0) label = `${label} (${seen + 1})`;

      return {
        mes: label,
        Total: h.totalMonthly,
        totalLabel: currency.format(h.totalMonthly),
      };
    });
  }, [operationalHistory]);

  const topMenuChartData = useMemo(
    () =>
      topExpensiveMenu.map((m) => ({
        plato: m.name.slice(0, 16),
        nombre: m.name,
        'Costo total': m.totalCost,
      })),
    [topExpensiveMenu]
  );

  const filteredMenu = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems.filter((m) => m.name.toLowerCase().includes(q));
  }, [menuItems, menuSearch]);

  const filteredRecipes = useMemo(() => {
    const q = recipeSearch.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(
      (r) =>
        r.internalCode.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q)
    );
  }, [recipes, recipeSearch]);

  return (
    <DashboardLayout>
      <div className="min-w-0 space-y-8">
        <div>
          <Title className="text-[#001F3F]">Reportes · Costos</Title>
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
            {!kpis.hasOperationalConfig && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
                No hay costos operativos configurados. El overhead indirecto por plato se calcula
                como $0 hasta que registres uno en{' '}
                <Link href="/costs/others" className="underline font-medium">
                  Costos operativos
                </Link>
                .
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <Card className={kpiCardClass} decoration="top" decorationColor="slate">
                <Text className="font-bold">Overhead mensual</Text>
                <Metric className={`${kpiMetricClass} !text-2xl sm:!text-3xl`}>
                  {kpis.totalMonthlyOperational != null
                    ? currency.format(kpis.totalMonthlyOperational)
                    : '—'}
                </Metric>
                <Text className="text-xs text-gray-500 mt-1">
                  {kpis.configMonth ? `Config: ${kpis.configMonth}` : 'Sin mes registrado'}
                </Text>
              </Card>
              <Card className={kpiCardClass} decoration="top" decorationColor="indigo">
                <Text className="font-bold">Costo prom. plato (total)</Text>
                <Metric className={`${kpiMetricClass} !text-2xl sm:!text-3xl`}>
                  {kpis.avgMenuTotalCost != null
                    ? currency.format(kpis.avgMenuTotalCost)
                    : '—'}
                </Metric>
                <Text className="text-xs text-gray-500 mt-1">
                  Base:{' '}
                  {kpis.avgMenuBaseCost != null
                    ? currency.format(kpis.avgMenuBaseCost)
                    : '—'}
                </Text>
              </Card>
              <Card className={kpiCardClass} decoration="top" decorationColor="emerald">
                <Text className="font-bold">Platos activos costeados</Text>
                <Metric className={kpiMetricClass}>{ni.format(kpis.activeMenuItems)}</Metric>
              </Card>
              <Card className={kpiCardClass} decoration="top" decorationColor="amber">
                <Text className="font-bold">Platos sin costo</Text>
                <Metric className={kpiMetricClass}>{ni.format(kpis.menuItemsWithZeroCost)}</Metric>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card>
                <Title className="text-base">Composición del overhead (config. vigente)</Title>
                {operationalDonut.length === 0 ? (
                  <Text className="mt-6">Sin configuración operativa.</Text>
                ) : (
                  <DonutChart
                    className="mt-4 h-56"
                    data={operationalDonut}
                    category="value"
                    index="name"
                    colors={['slate', 'cyan', 'indigo']}
                    valueFormatter={(v) => currency.format(v)}
                    showLabel={true}
                  />
                )}
              </Card>
              <Card>
                <Title className="text-base">Evolución overhead mensual</Title>
                <Text className="text-sm mt-1">Últimas configuraciones registradas.</Text>
                {historyChartData.length === 0 ? (
                  <Text className="mt-6">Sin historial.</Text>
                ) : (
                  <BarChart
                    className="mt-4 h-72"
                    data={historyChartData}
                    index="mes"
                    categories={['Total']}
                    colors={['slate']}
                    yAxisWidth={56}
                    valueFormatter={formatCompactCop}
                    customTooltip={OverheadHistoryTooltip}
                    showLegend={false}
                    showAnimation={true}
                  />
                )}
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card>
                <Title className="text-base">Top 10 platos por costo total</Title>
                <Text className="text-sm mt-1">Insumos + overhead indirecto por plato.</Text>
                {topMenuChartData.length === 0 ? (
                  <Text className="mt-6">Sin platos con costo.</Text>
                ) : (
                  <BarChart
                    className="mt-4 h-80"
                    data={topMenuChartData}
                    index="plato"
                    categories={['Costo total']}
                    colors={['indigo']}
                    layout="horizontal"
                    yAxisWidth={88}
                    valueFormatter={(v) => currency.format(v)}
                    customTooltip={MenuCostTooltip}
                    showLegend={false}
                  />
                )}
              </Card>
              <Card>
                <Title className="text-base">Top recetas por costo / porción</Title>
                <Text className="text-sm mt-1">Solo ingredientes (sin overhead).</Text>
                {topExpensiveRecipes.length === 0 ? (
                  <Text className="mt-4">Sin recetas con costo.</Text>
                ) : (
                  <div className="overflow-x-auto max-h-[320px] overflow-y-auto mt-4">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>Receta</TableHeaderCell>
                          <TableHeaderCell className="text-right">Costo/porción</TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {topExpensiveRecipes.map((r) => (
                          <TableRow key={r.recipeId}>
                            <TableCell className="text-sm">
                              <span className="font-mono">{r.internalCode}</span>
                              <Text className="text-xs text-gray-600">{r.name}</Text>
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {currency.format(r.costPerPortion)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            </div>

            {zeroCostMenu.length > 0 && (
              <Card>
                <Title className="text-base">Platos activos sin costo calculado</Title>
                <Text className="text-sm mt-1">
                  Revisa componentes o precios unitarios de insumos en el catálogo.
                </Text>
                <div className="overflow-x-auto mt-4">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Plato</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {zeroCostMenu.map((m) => (
                        <TableRow key={m.menuItemId}>
                          <TableCell className="text-sm font-medium">{m.name}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}

            <Card>
              <TabGroup>
                <TabList variant="solid" className="max-w-md">
                  <Tab>Platos</Tab>
                  <Tab>Recetas</Tab>
                </TabList>
                <TabPanels>
                  <TabPanel>
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4 mt-4">
                      <div>
                        <Title className="text-base">Detalle por plato</Title>
                        <Text className="text-sm">Costo base, indirecto, food cost y precio sugerido</Text>
                      </div>
                      <div className="max-w-xs w-full">
                        <TextInput
                          placeholder="Buscar plato…"
                          value={menuSearch}
                          onValueChange={setMenuSearch}
                        />
                      </div>
                    </div>
                    <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableHeaderCell>Plato</TableHeaderCell>
                            <TableHeaderCell>Estado</TableHeaderCell>
                            <TableHeaderCell className="text-right">Base</TableHeaderCell>
                            <TableHeaderCell className="text-right">Indirecto</TableHeaderCell>
                            <TableHeaderCell className="text-right">Total</TableHeaderCell>
                            <TableHeaderCell className="text-right">Food cost</TableHeaderCell>
                            <TableHeaderCell className="text-right">Precio sug.</TableHeaderCell>
                            <TableHeaderCell className="text-right">Utilidad est.</TableHeaderCell>
                            <TableHeaderCell></TableHeaderCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredMenu.map((m) => (
                            <TableRow key={m.menuItemId}>
                              <TableCell className="font-medium text-sm">{m.name}</TableCell>
                              <TableCell>
                                <Badge color={m.active ? 'emerald' : 'gray'}>
                                  {m.active ? 'Activo' : 'Inactivo'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {currency.format(m.baseCost)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {currency.format(m.indirectCost)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm font-medium">
                                {currency.format(m.totalCost)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {m.suggestedPrice > 0 ? (
                                  <span className={m.foodCostPct >= 40 ? 'text-amber-700 font-medium' : ''}>
                                    {nf.format(m.foodCostPct)}%
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {m.suggestedPrice > 0 ? currency.format(m.suggestedPrice) : '—'}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {m.estimatedUtility > 0
                                  ? currency.format(m.estimatedUtility)
                                  : '—'}
                              </TableCell>
                              <TableCell>
                                <Link
                                  href="/costs/price"
                                  className="text-sm text-blue-700 hover:underline whitespace-nowrap"
                                >
                                  Precio
                                </Link>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabPanel>
                  <TabPanel>
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4 mt-4">
                      <div>
                        <Title className="text-base">Detalle por receta</Title>
                        <Text className="text-sm">Costo de ingredientes por lote y por porción</Text>
                      </div>
                      <div className="max-w-xs w-full">
                        <TextInput
                          placeholder="Buscar código o nombre…"
                          value={recipeSearch}
                          onValueChange={setRecipeSearch}
                        />
                      </div>
                    </div>
                    <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableHeaderCell>Código</TableHeaderCell>
                            <TableHeaderCell>Receta</TableHeaderCell>
                            <TableHeaderCell>Estado</TableHeaderCell>
                            <TableHeaderCell className="text-right">Porciones</TableHeaderCell>
                            <TableHeaderCell className="text-right">Costo lote</TableHeaderCell>
                            <TableHeaderCell className="text-right">Costo/porción</TableHeaderCell>
                            <TableHeaderCell></TableHeaderCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredRecipes.map((r) => (
                            <TableRow key={r.recipeId}>
                              <TableCell className="font-mono text-sm">{r.internalCode}</TableCell>
                              <TableCell className="font-medium text-sm">{r.name}</TableCell>
                              <TableCell>
                                <Badge color={r.active ? 'emerald' : 'gray'}>
                                  {r.active ? 'Activa' : 'Inactiva'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {ni.format(r.portions)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {currency.format(r.ingredientsCost)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {currency.format(r.costPerPortion)}
                              </TableCell>
                              <TableCell>
                                <Link
                                  href="/costs/total"
                                  className="text-sm text-blue-700 hover:underline whitespace-nowrap"
                                >
                                  Calcular
                                </Link>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabPanel>
                </TabPanels>
              </TabGroup>
            </Card>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
