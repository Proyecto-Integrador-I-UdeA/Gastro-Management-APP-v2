import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Login from '@/pages/login';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ apiFetch: mocks.apiFetch }));
vi.mock('@/components/Header', () => ({ default: () => null }));
vi.mock('@/utils/toast', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('/login', () => {
  it('muestra Crear cuenta cuando el registro inicial está disponible', async () => {
    mocks.apiFetch.mockResolvedValue({ registrationAvailable: true });

    render(<Login />);

    expect(await screen.findByRole('link', { name: 'Crear cuenta' })).toBeInTheDocument();
  });

  it('oculta Crear cuenta cuando el registro inicial no está disponible', async () => {
    mocks.apiFetch.mockResolvedValue({ registrationAvailable: false });

    render(<Login />);

    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenCalledWith('/auth/register/status');
    });
    expect(screen.queryByRole('link', { name: 'Crear cuenta' })).not.toBeInTheDocument();
  });
});
