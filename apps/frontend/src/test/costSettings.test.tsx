import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CostSettingsPage from '@/pages/costs/settings';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  permissions: vi.fn(),
}));

vi.mock('@/utils/apiFetch', () => ({ apiFetch: mocks.apiFetch }));
vi.mock('@/utils/permissions', () => ({ getUserPermissions: mocks.permissions }));
vi.mock('@/hooks/useAuthGuard', () => ({ useAuthGuard: vi.fn() }));
vi.mock('@/components/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('Configuración de merma global', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissions.mockReturnValue(['costs.read', 'costs.update']);
    mocks.apiFetch.mockResolvedValue({ wastePercent: 8, updatedAt: null, updatedBy: null });
  });

  it('carga y guarda el porcentaje global autorizado', async () => {
    const user = userEvent.setup();
    render(<CostSettingsPage />);
    const input = await screen.findByRole('spinbutton', { name: 'Merma general estimada' });
    expect(input).toHaveValue(8);
    await user.clear(input);
    await user.type(input, '10');
    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/costs/settings/waste',
      { method: 'PUT', json: { wastePercent: 10 } },
    ));
    expect(await screen.findByRole('status')).toHaveTextContent('actualizada correctamente');
  });

  it('valida el rango y no envía un porcentaje inválido', async () => {
    const user = userEvent.setup();
    render(<CostSettingsPage />);
    const input = await screen.findByRole('spinbutton', { name: 'Merma general estimada' });
    await user.clear(input);
    await user.type(input, '101');
    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('entre 0 y 100');
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);

    await user.clear(input);
    await user.type(input, '8.001');
    await user.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('máximo 2 decimales');
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
  });

  it('mantiene el valor visible pero no permite editar sin costs.update', async () => {
    mocks.permissions.mockReturnValue(['costs.read']);
    render(<CostSettingsPage />);
    expect(await screen.findByRole('spinbutton', { name: 'Merma general estimada' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Guardar configuración' })).not.toBeInTheDocument();
  });
});
