import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PhysicalCountsPage from '@/pages/inventory/counts';
import NewPhysicalCountPage from '@/pages/inventory/counts/new';
import PhysicalCountDetailPage from '@/pages/inventory/counts/[id]';
import PhysicalCountEditor from '@/components/inventory/PhysicalCountEditor';

const mocks = vi.hoisted(() => ({
  push: vi.fn(), router: { query: {} as Record<string, string>, isReady: true },
  fetchCounts: vi.fn(), fetchCount: vi.fn(), fetchRefs: vi.fn(), create: vi.fn(), update: vi.fn(), post: vi.fn(), cancel: vi.fn(), refresh: vi.fn(),
}));
vi.mock('next/router', () => ({ useRouter: () => ({ ...mocks.router, push: mocks.push }) }));
vi.mock('@/hooks/useAuthGuard', () => ({ useAuthGuard: vi.fn() }));
vi.mock('@/components/layouts/DashboardLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/inventoryPhysicalCountsApi', () => ({
  fetchPhysicalCounts: mocks.fetchCounts, fetchPhysicalCount: mocks.fetchCount, fetchCountReferences: mocks.fetchRefs,
  createPhysicalCount: mocks.create, updatePhysicalCount: mocks.update, postPhysicalCount: mocks.post,
  cancelPhysicalCount: mocks.cancel, refreshPhysicalCount: mocks.refresh,
}));

const refs = {
  warehouses: [{ id: 1, name: 'Bodega Principal', active: true, isMain: true }],
  products: [
    { id: 10, internalCode: 'POL', name: 'Pollo', unitOfMeasure: 'g', systemQuantity: 10, unitCostEstimate: '18' },
    { id: 11, internalCode: 'AGU', name: 'Aguacate', unitOfMeasure: 'g', systemQuantity: -0.2, unitCostEstimate: '10' },
    { id: 12, internalCode: 'P-001', name: 'Pechuga de pollo', unitOfMeasure: 'g', systemQuantity: 0, unitCostEstimate: '18' },
    { id: 13, internalCode: 'SIN-01', name: 'Producto sin balance', unitOfMeasure: 'und', systemQuantity: 0, unitCostEstimate: null },
  ],
};
const draft = {
  id: 7, warehouseId: 1, status: 'DRAFT', reason: 'PHYSICAL_COUNT', notes: null,
  createdAt: '2026-09-15T12:00:00.000Z', updatedAt: '2026-09-15T12:00:00.000Z', postedAt: null, cancelledAt: null,
  warehouse: refs.warehouses[0], createdBy: { id: 1, fullName: 'Ana', email: 'ana@test' }, updatedBy: { id: 1, fullName: 'Ana', email: 'ana@test' }, postedBy: null, cancelledBy: null,
  items: [{ id: 70, productId: 10, systemQuantitySnapshot: 10, countedQuantity: 8, varianceQuantity: null, unit: 'g', unitCostSnapshot: '18', estimatedValueVariance: null, inventoryMovementId: null, product: { id: 10, internalCode: 'POL', name: 'Pollo', unitOfMeasure: 'g' }, inventoryMovement: null }],
} as const;

beforeEach(() => {
  vi.clearAllMocks(); mocks.router.query = {}; mocks.fetchRefs.mockResolvedValue(refs); mocks.fetchCounts.mockResolvedValue([draft]); mocks.fetchCount.mockResolvedValue(draft); mocks.create.mockResolvedValue(draft); mocks.update.mockResolvedValue(draft); mocks.post.mockResolvedValue({ ...draft, status: 'POSTED' }); mocks.cancel.mockResolvedValue({ ...draft, status: 'CANCELLED' });
});

function StatefulEditor() {
  const [lines, setLines] = React.useState<Array<{ productId: number; countedQuantity: number | null }>>([]);
  return <>
    <PhysicalCountEditor references={refs} warehouseId={1} lines={lines} reason="PHYSICAL_COUNT" notes="" onLines={setLines} onReason={vi.fn()} onNotes={vi.fn()} />
    <output data-testid="selected-products">{lines.map(line => line.productId).join(',')}</output>
  </>;
}

describe('Inventario físico', () => {
  it('lista el histórico y ofrece crear/consultar conteos', async () => {
    render(<PhysicalCountsPage />);
    expect(await screen.findByText('#7')).toBeInTheDocument();
    expect(screen.getByText('Bodega Principal')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nuevo conteo' })).toHaveAttribute('href', '/inventory/counts/new');
    expect(screen.getByRole('link', { name: 'Ver detalle' })).toHaveAttribute('href', '/inventory/counts/7');
  });

  it('muestra sistema, físico, diferencias positivas/negativas, stock negativo y validación local', async () => {
    const user = userEvent.setup(); const onLines = vi.fn();
    const { rerender } = render(<PhysicalCountEditor references={refs} warehouseId={1} lines={[{ productId: 10, countedQuantity: 8 }, { productId: 11, countedQuantity: 0.4 }]} reason="PHYSICAL_COUNT" notes="" onLines={onLines} onReason={vi.fn()} onNotes={vi.fn()} />);
    expect(screen.getByText('10 g')).toBeInTheDocument(); expect(screen.getByText('-0,2 g')).toBeInTheDocument();
    expect(screen.getByText('-2 g')).toBeInTheDocument(); expect(screen.getByText('+0,6 g')).toBeInTheDocument();
    expect(screen.getAllByText(/Impacto estimado/).find(element => element.tagName === 'P')).toHaveTextContent(/-.*30/);
    rerender(<PhysicalCountEditor references={refs} warehouseId={1} lines={[{ productId: 10, countedQuantity: -1 }]} reason="PHYSICAL_COUNT" notes="" onLines={onLines} onReason={vi.fn()} onNotes={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('mayor o igual a 0');
    await user.type(screen.getByLabelText('Buscar y agregar producto'), 'agu');
    await user.click(screen.getByRole('option', { name: 'Aguacate — AGU' }));
    expect(onLines).toHaveBeenCalledWith([{ productId: 10, countedQuantity: -1 }, { productId: 11, countedQuantity: null }]);
  });

  it('busca por nombre compuesto, coincidencia parcial y sin distinguir mayúsculas', async () => {
    const user = userEvent.setup(); render(<StatefulEditor />);
    const search = screen.getByLabelText('Buscar y agregar producto');
    await user.type(search, 'PeChUgA');
    expect(screen.getByRole('option', { name: 'Pechuga de pollo — P-001' })).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'Pechuga de pollo — P-001');
    expect(screen.getByRole('option', { name: 'Pechuga de pollo — P-001' })).toBeInTheDocument();
  });

  it('busca por código, agrega con Enter, limpia el campo y excluye duplicados', async () => {
    const user = userEvent.setup(); render(<StatefulEditor />);
    const search = screen.getByLabelText('Buscar y agregar producto');
    await user.type(search, 'p-001');
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('selected-products')).toHaveTextContent('12');
    expect(search).toHaveValue('');
    await user.click(search);
    await user.type(search, 'p-001');
    expect(screen.queryByRole('option', { name: 'Pechuga de pollo — P-001' })).not.toBeInTheDocument();
    expect(screen.getByText('No se encontraron productos')).toBeInTheDocument();
  });

  it('ofrece productos con stock negativo y con snapshot cero sin balance previo', async () => {
    const user = userEvent.setup(); render(<StatefulEditor />);
    const search = screen.getByLabelText('Buscar y agregar producto');
    await user.type(search, 'agu');
    expect(screen.getByRole('option', { name: 'Aguacate — AGU' })).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'sin-01');
    expect(screen.getByRole('option', { name: 'Producto sin balance — SIN-01' })).toBeInTheDocument();
  });

  it('muestra un estado vacío claro cuando la búsqueda no coincide', async () => {
    const user = userEvent.setup(); render(<StatefulEditor />);
    await user.type(screen.getByLabelText('Buscar y agregar producto'), 'producto inexistente');
    expect(screen.getByText('No se encontraron productos')).toBeInTheDocument();
  });

  it('crea un conteo parcial y conserva vacío como cantidad incompleta', async () => {
    const user = userEvent.setup(); render(<NewPhysicalCountPage />);
    await waitFor(() => expect(screen.getByLabelText('Bodega')).toHaveValue('1'));
    expect(mocks.fetchRefs).toHaveBeenCalledWith(1);
    await user.type(screen.getByLabelText('Buscar y agregar producto'), 'pol');
    await user.click(screen.getByRole('option', { name: 'Pollo — POL' }));
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(mocks.create).toHaveBeenCalledWith({ warehouseId: 1, reason: 'PHYSICAL_COUNT', notes: null, items: [{ productId: 10, countedQuantity: null }] });
    expect(mocks.push).toHaveBeenCalledWith('/inventory/counts/7');
  });

  it('publica tras guardar y presenta el conflicto stale con acción de actualización', async () => {
    mocks.router.query = { id: '7' }; const stale = Object.assign(new Error('conflict'), { body: { code: 'INVENTORY_PHYSICAL_COUNT_STALE' } }); mocks.post.mockRejectedValue(stale);
    const user = userEvent.setup(); render(<PhysicalCountDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Publicar ajuste' }));
    expect(mocks.update).toHaveBeenCalled(); expect(mocks.post).toHaveBeenCalledWith(7);
    expect(await screen.findByRole('alert')).toHaveTextContent('El inventario cambió');
    expect(screen.getByRole('button', { name: 'Actualizar saldos y recontar' })).toBeInTheDocument();
  });

  it('cancela el borrador sin publicar', async () => {
    mocks.router.query = { id: '7' }; const user = userEvent.setup(); render(<PhysicalCountDetailPage />);
    await user.click(await screen.findByRole('button', { name: 'Cancelar borrador' }));
    expect(mocks.cancel).toHaveBeenCalledWith(7); expect(mocks.post).not.toHaveBeenCalled();
  });

  it('deja publicado en solo lectura y muestra snapshots y movimiento', async () => {
    mocks.router.query = { id: '7' }; mocks.fetchCount.mockResolvedValue({ ...draft, status: 'POSTED', postedAt: '2026-09-15T13:00:00.000Z', postedBy: draft.createdBy, items: [{ ...draft.items[0], varianceQuantity: -2, estimatedValueVariance: '-36', inventoryMovementId: 42, inventoryMovement: { id: 42, quantity: -2, createdAt: '2026-09-15T13:00:00.000Z' } }] });
    render(<PhysicalCountDetailPage />);
    expect(await screen.findByText(/movimiento #42/)).toBeInTheDocument();
    expect(screen.getByLabelText('Cantidad física Pollo')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Publicar ajuste' })).not.toBeInTheDocument();
  });
});
