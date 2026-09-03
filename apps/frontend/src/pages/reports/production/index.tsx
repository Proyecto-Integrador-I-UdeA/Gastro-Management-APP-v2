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
import { fetchProductionReport } from '@/lib/reportsApi';
import { getApiErrorMessage, isUnauthorized } from '@/lib/apiError';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import type { ProductionMenuRow, ProductionRecipeRow, ProductionReportResponse } from '@/types/reports';

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

function costClassificationLabel(value: string | null): string {
  switch (value) {
    case 'LOW':
      return 'Bajo';
    case 'MEDIUM':
      return 'Medio';
    case 'HIGH':
      return 'Alto';
    case 'PREMIUM':
      return 'Premium';
    case 'UNCLASSIFIED':
    case 'SIN_CLASIFICAR':
      return 'Sin clasificar';
    default:
      return value ?? '—';
  }
}

function nutritionRoleLabel(value: string | null): string {
  switch (value) {
    case 'CARB_BASE':
      return 'Base carbohidratos';
    case 'PROTEIN_BASE':
      return 'Base proteína';
    case 'FAT_BASE':
      return 'Base grasa';
    case 'BALANCED':
      return 'Balanceado';
    case 'SIN_ROL':
      return 'Sin rol';
    default:
      return value ?? '—';
  }
}

function RecipeCostTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { nombre?: string; 'Costo/porción'?: number } | undefined;
  if (!row) return null;
  return (
    <div className="rounded-tremor-default border border-tremor-border bg-tremor-background px-3 py-2 text-tremor-default shadow-tremor-dropdown">
      <p className="font-medium text-tremor-content-emphasis">{row.nombre ?? '—'}</p>
      <p className="mt-1 text-sm text-tremor-content">
        Costo/porción: {currency.format(row['Costo/porción'] ?? 0)}
      </p>
    </div>
  );
}

function MenuCostTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as { nombre?: string; 'Costo plato'?: number } | undefined;
  if (!row) return null;
  return (
    <div className="rounded-tremor-default border border-tremor-border bg-tremor-background px-3 py-2 text-tremor-default shadow-tremor-dropdown">
      <p className="font-medium text-tremor-content-emphasis">{row.nombre ?? '—'}</p>
      <p className="mt-1 text-sm text-tremor-content">
        Costo plato: {currency.format(row['Costo plato'] ?? 0)}
      </p>
    </div>
  );
}

export default function ReportsProductionPage() {
  useAuthGuard('reports.read');

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<ProductionReportResponse['kpis'] | null>(null);
  const [recipes, setRecipes] = useState<ProductionRecipeRow[]>([]);
  const [menuItems, setMenuItems] = useState<ProductionMenuRow[]>([]);
  const [costClassification, setCostClassification] = useState<
    { classification: string; count: number }[]
  >([]);
  const [nutritionRole, setNutritionRole] = useState<{ role: string; count: number }[]>([]);
  const [topExpensiveRecipes, setTopExpensiveRecipes] = useState<ProductionRecipeRow[]>([]);
  const [topExpensiveMenuItems, setTopExpensiveMenuItems] = useState<ProductionMenuRow[]>([]);
  const [longestProcessRecipes, setLongestProcessRecipes] = useState<ProductionRecipeRow[]>([]);
  const [standardizationGaps, setStandardizationGaps] = useState<ProductionRecipeRow[]>([]);
  const [orphanRecipes, setOrphanRecipes] = useState<ProductionRecipeRow[]>([]);
  const [incompleteMenu, setIncompleteMenu] = useState<ProductionMenuRow[]>([]);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [menuSearch, setMenuSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProductionReport();
      setKpis(data.kpis);
      setRecipes(data.recipes);
      setMenuItems(data.menuItems);
      setCostClassification(data.distributions.costClassification);
      setNutritionRole(data.distributions.nutritionRole);
      setTopExpensiveRecipes(data.rankings.topExpensiveRecipes);
      setTopExpensiveMenuItems(data.rankings.topExpensiveMenuItems);
      setLongestProcessRecipes(data.rankings.longestProcessRecipes);
      setStandardizationGaps(data.rankings.standardizationGaps);
      setOrphanRecipes(data.rankings.orphanRecipes);
      setIncompleteMenu(data.rankings.incompleteMenu);
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

  const costClassDonut = useMemo(
    () =>
      costClassification.map((d) => ({
        name: costClassificationLabel(d.classification),
        value: d.count,
      })),
    [costClassification]
  );

  const nutritionRoleDonut = useMemo(
    () =>
      nutritionRole.map((d) => ({
        name: nutritionRoleLabel(d.role),
        value: d.count,
      })),
    [nutritionRole]
  );

  const topRecipeChartData = useMemo(
    () =>
      topExpensiveRecipes.map((r) => ({
        receta: r.internalCode.slice(0, 14),
        nombre: r.name,
        'Costo/porción': r.costPerPortion ?? 0,
      })),
    [topExpensiveRecipes]
  );

  const topMenuChartData = useMemo(
    () =>
      topExpensiveMenuItems.map((m) => ({
        plato: m.name.slice(0, 18),
        nombre: m.name,
        'Costo plato': m.totalCost ?? 0,
      })),
    [topExpensiveMenuItems]
  );

  const filteredRecipes = useMemo(() => {
    const q = recipeSearch.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(
      (r) =>
        r.internalCode.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q)
    );
  }, [recipes, recipeSearch]);

  const filteredMenu = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    if (!q) return menuItems;
    return menuItems.filter((m) => m.name.toLowerCase().includes(q));
  }, [menuItems, menuSearch]);

  return (
    <DashboardLayout>
      <div className="min-w-0 space-y-8">
        <div>
          <Title className="text-[#001F3F]">Reportes · Producción</Title>
          <Text className="mt-1">
            Componentes (recetas estandarizadas) y platos del menú: costos, tiempos de proceso y
            brechas de estandarización.
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
              <Card className={kpiCardClass} decoration="top" decorationColor="slate">
                <Text className="font-bold">Recetas activas</Text>
                <Metric className={kpiMetricClass}>{ni.format(kpis.activeRecipes)}</Metric>
                <Text className="text-xs text-gray-500 mt-1">
                  {ni.format(kpis.totalRecipes)} en catálogo
                </Text>
              </Card>
              <Card className={kpiCardClass} decoration="top" decorationColor="cyan">
                <Text className="font-bold">Platos activos en menú</Text>
                <Metric className={kpiMetricClass}>{ni.format(kpis.activeMenuItems)}</Metric>
                <Text className="text-xs text-gray-500 mt-1">
                  {ni.format(kpis.totalMenuItems)} registrados
                </Text>
              </Card>
              <Card className={kpiCardClass} decoration="top" decorationColor="amber">
                <Text className="font-bold">Recetas incompletas</Text>
                <Metric className={kpiMetricClass}>{ni.format(kpis.incompleteRecipes)}</Metric>
                <Text className="text-xs text-gray-500 mt-1">
                  {ni.format(kpis.recipesMissingProcesses)} sin procesos
                </Text>
              </Card>
              <Card className={kpiCardClass} decoration="top" decorationColor="violet">
                <Text className="font-bold">Recetas sin uso en menú</Text>
                <Metric className={kpiMetricClass}>{ni.format(kpis.recipesNotInMenu)}</Metric>
                <Text className="text-xs text-gray-500 mt-1">
                  Activas y no vinculadas a platos
                </Text>
              </Card>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <Card className={kpiCardClass} decoration="top" decorationColor="emerald">
                <Text className="font-bold">Costo prom. por porción (receta)</Text>
                <Metric className={`${kpiMetricClass} !text-2xl sm:!text-3xl`}>
                  {kpis.avgRecipeCostPerPortion != null
                    ? currency.format(kpis.avgRecipeCostPerPortion)
                    : '—'}
                </Metric>
              </Card>
              <Card className={kpiCardClass} decoration="top" decorationColor="indigo">
                <Text className="font-bold">Costo prom. por plato</Text>
                <Metric className={`${kpiMetricClass} !text-2xl sm:!text-3xl`}>
                  {kpis.avgMenuItemCost != null
                    ? currency.format(kpis.avgMenuItemCost)
                    : '—'}
                </Metric>
              </Card>
              <Card className={kpiCardClass} decoration="top" decorationColor="orange">
                <Text className="font-bold">Platos sin componentes</Text>
                <Metric className={kpiMetricClass}>{ni.format(kpis.incompleteMenuItems)}</Metric>
              </Card>
              <Card className={kpiCardClass} decoration="top" decorationColor="rose">
                <Text className="font-bold">Platos activos sin costo</Text>
                <Metric className={kpiMetricClass}>{ni.format(kpis.menuItemsWithoutCost)}</Metric>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card>
                <Title className="text-base">Clasificación de costo (recetas activas)</Title>
                {costClassDonut.every((d) => d.value === 0) ? (
                  <Text className="mt-6">Sin datos.</Text>
                ) : (
                  <DonutChart
                    className="mt-4 h-56"
                    data={costClassDonut}
                    category="value"
                    index="name"
                    colors={['emerald', 'cyan', 'amber', 'orange', 'rose', 'gray']}
                    valueFormatter={(v) => ni.format(v)}
                    showLabel={true}
                  />
                )}
              </Card>
              <Card>
                <Title className="text-base">Rol nutricional (recetas activas)</Title>
                {nutritionRoleDonut.every((d) => d.value === 0) ? (
                  <Text className="mt-6">Sin datos.</Text>
                ) : (
                  <DonutChart
                    className="mt-4 h-56"
                    data={nutritionRoleDonut}
                    category="value"
                    index="name"
                    colors={['cyan', 'indigo', 'amber', 'emerald', 'gray']}
                    valueFormatter={(v) => ni.format(v)}
                    showLabel={true}
                  />
                )}
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card>
                <Title className="text-base">Top 10 recetas por costo/porción</Title>
                <Text className="text-sm mt-1">Solo recetas activas con costo calculado.</Text>
                {topRecipeChartData.length === 0 ? (
                  <Text className="mt-6">Sin recetas con costo.</Text>
                ) : (
                  <BarChart
                    className="mt-4 h-80"
                    data={topRecipeChartData}
                    index="receta"
                    categories={['Costo/porción']}
                    colors={['violet']}
                    layout="horizontal"
                    yAxisWidth={72}
                    valueFormatter={(v) => currency.format(v)}
                    customTooltip={RecipeCostTooltip}
                    showLegend={false}
                  />
                )}
              </Card>
              <Card>
                <Title className="text-base">Top 10 platos por costo total</Title>
                <Text className="text-sm mt-1">Platos activos con costo registrado.</Text>
                {topMenuChartData.length === 0 ? (
                  <Text className="mt-6">Sin platos con costo.</Text>
                ) : (
                  <BarChart
                    className="mt-4 h-80"
                    data={topMenuChartData}
                    index="plato"
                    categories={['Costo plato']}
                    colors={['indigo']}
                    layout="horizontal"
                    yAxisWidth={88}
                    valueFormatter={(v) => currency.format(v)}
                    customTooltip={MenuCostTooltip}
                    showLegend={false}
                  />
                )}
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <Title className="text-base">Brechas de estandarización</Title>
                <Text className="text-sm mt-1">
                  Recetas activas sin ingredientes o sin procesos documentados.
                </Text>
                {standardizationGaps.length === 0 ? (
                  <Text className="mt-4">Todas las recetas activas tienen ingredientes y procesos.</Text>
                ) : (
                  <div className="overflow-x-auto max-h-[320px] overflow-y-auto mt-4">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>Receta</TableHeaderCell>
                          <TableHeaderCell>Detalle</TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {standardizationGaps.map((r) => (
                          <TableRow key={r.recipeId}>
                            <TableCell className="text-sm">
                              <span className="font-mono">{r.internalCode}</span>
                              <Text className="text-xs text-gray-600">{r.name}</Text>
                            </TableCell>
                            <TableCell className="text-sm">
                              {r.itemCount === 0 && (
                                <Badge color="red" className="mr-1">
                                  Sin ingredientes
                                </Badge>
                              )}
                              {r.missingProcesses && (
                                <Badge color="amber">Sin procesos</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
              <Card>
                <Title className="text-base">Recetas activas no usadas en menú</Title>
                <Text className="text-sm mt-1">
                  Componentes que aún no forman parte de ningún plato.
                </Text>
                {orphanRecipes.length === 0 ? (
                  <Text className="mt-4">Todas las recetas activas están en al menos un plato.</Text>
                ) : (
                  <div className="overflow-x-auto max-h-[320px] overflow-y-auto mt-4">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableHeaderCell>Código</TableHeaderCell>
                          <TableHeaderCell>Nombre</TableHeaderCell>
                          <TableHeaderCell className="text-right">Costo/porción</TableHeaderCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {orphanRecipes.map((r) => (
                          <TableRow key={r.recipeId}>
                            <TableCell className="font-mono text-sm">{r.internalCode}</TableCell>
                            <TableCell className="text-sm">{r.name}</TableCell>
                            <TableCell className="text-right tabular-nums text-sm">
                              {r.costPerPortion != null
                                ? currency.format(r.costPerPortion)
                                : '—'}
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
              <Title className="text-base">Mayor tiempo de proceso documentado</Title>
              <Text className="text-sm mt-1">
                Suma de duraciones de procesos por receta (minutos).
              </Text>
              {longestProcessRecipes.length === 0 ? (
                <Text className="mt-4">Ninguna receta con procesos registrados.</Text>
              ) : (
                <div className="overflow-x-auto max-h-[280px] overflow-y-auto mt-4">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Receta</TableHeaderCell>
                        <TableHeaderCell className="text-right">Procesos</TableHeaderCell>
                        <TableHeaderCell className="text-right">Minutos</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {longestProcessRecipes.map((r) => (
                        <TableRow key={r.recipeId}>
                          <TableCell className="text-sm">
                            <span className="font-mono">{r.internalCode}</span>
                            <Text className="text-xs text-gray-600">{r.name}</Text>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {ni.format(r.processCount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-sm">
                            {nf.format(r.totalProcessMinutes)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>

            {incompleteMenu.length > 0 && (
              <Card>
                <Title className="text-base">Platos activos sin componentes</Title>
                <div className="overflow-x-auto mt-4">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableHeaderCell>Plato</TableHeaderCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {incompleteMenu.map((m) => (
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
                  <Tab>Recetas</Tab>
                  <Tab>Platos del menú</Tab>
                </TabList>
                <TabPanels>
                  <TabPanel>
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4 mt-4">
                      <div>
                        <Title className="text-base">Detalle de recetas</Title>
                        <Text className="text-sm">Costo, procesos y uso en menú</Text>
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
                            <TableHeaderCell className="text-right">Costo/porción</TableHeaderCell>
                            <TableHeaderCell className="text-right">Procesos</TableHeaderCell>
                            <TableHeaderCell className="text-right">En menú</TableHeaderCell>
                            <TableHeaderCell>Clasificación</TableHeaderCell>
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
                                {r.incomplete && (
                                  <Badge color="amber" className="ml-1">
                                    Incompleta
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {ni.format(r.portions)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {r.costPerPortion != null
                                  ? currency.format(r.costPerPortion)
                                  : '—'}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {ni.format(r.processCount)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {ni.format(r.usedInMenuCount)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {costClassificationLabel(r.costClassification)}
                              </TableCell>
                              <TableCell>
                                <Link
                                  href={`/recipes/${r.recipeId}`}
                                  className="text-sm text-blue-700 hover:underline whitespace-nowrap"
                                >
                                  Ver
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
                        <Title className="text-base">Detalle de platos</Title>
                        <Text className="text-sm">Componentes, costo y nutrición</Text>
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
                            <TableHeaderCell className="text-right">Componentes</TableHeaderCell>
                            <TableHeaderCell className="text-right">Recetas</TableHeaderCell>
                            <TableHeaderCell className="text-right">Productos</TableHeaderCell>
                            <TableHeaderCell className="text-right">Costo</TableHeaderCell>
                            <TableHeaderCell className="text-right">Calorías</TableHeaderCell>
                            <TableHeaderCell className="text-right">Score</TableHeaderCell>
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
                                {m.incomplete && (
                                  <Badge color="amber" className="ml-1">
                                    Sin componentes
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {ni.format(m.componentCount)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {ni.format(m.recipeComponentCount)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {ni.format(m.productComponentCount)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {m.totalCost != null && m.totalCost > 0
                                  ? currency.format(m.totalCost)
                                  : '—'}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {m.caloriesPerPortion != null
                                  ? nf.format(m.caloriesPerPortion)
                                  : '—'}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {m.nutritionScore != null ? nf.format(m.nutritionScore) : '—'}
                              </TableCell>
                              <TableCell>
                                <Link
                                  href={`/menu/edit/${m.menuItemId}`}
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