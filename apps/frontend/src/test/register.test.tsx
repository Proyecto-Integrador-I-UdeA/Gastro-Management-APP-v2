import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Register from '@/pages/register';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  push: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ apiFetch: mocks.apiFetch }));
vi.mock('next/router', () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('@/utils/toast', () => ({
  showError: mocks.showError,
  showSuccess: mocks.showSuccess,
}));
vi.mock('@/components/Header', () => ({ default: () => null }));

function getInput(name: string): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!input) throw new Error(`No se encontró el input ${name}`);
  return input;
}

async function renderAvailableRegistration() {
  mocks.apiFetch.mockImplementation(async (endpoint: string) => {
    if (endpoint === '/auth/register/status') {
      return { registrationAvailable: true };
    }
    return {};
  });
  render(<Register />);
  await screen.findByRole('button', { name: 'Crear cuenta' });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('/register', () => {
  it('renderiza los cuatro campos y no muestra selector de rol', async () => {
    await renderAvailableRegistration();

    expect(screen.getByText('Nombre completo')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Contraseña')).toBeInTheDocument();
    expect(screen.getByText('Confirmar contraseña')).toBeInTheDocument();
    expect(document.querySelector('select[name="roleId"]')).not.toBeInTheDocument();
  });

  it('muestra validación cuando las contraseñas no coinciden y no registra', async () => {
    await renderAvailableRegistration();
    const user = userEvent.setup();

    await user.type(getInput('fullName'), 'Admin Inicial');
    await user.type(getInput('email'), 'owner@example.test');
    await user.type(getInput('password'), 'password-seguro');
    await user.type(getInput('confirmPassword'), 'password-distinto');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument();
    expect(mocks.apiFetch).not.toHaveBeenCalledWith(
      '/auth/register',
      expect.anything(),
    );
  });

  it('envía el registro, muestra éxito y redirige al login', async () => {
    await renderAvailableRegistration();
    const user = userEvent.setup();

    await user.type(getInput('fullName'), 'Admin Inicial');
    await user.type(getInput('email'), 'owner@example.test');
    await user.type(getInput('password'), 'password-seguro');
    await user.type(getInput('confirmPassword'), 'password-seguro');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenCalledWith('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Admin Inicial',
          email: 'owner@example.test',
          password: 'password-seguro',
        }),
      });
    });
    expect(mocks.showSuccess).toHaveBeenCalledWith('Cuenta inicial creada exitosamente');
    expect(mocks.push).toHaveBeenCalledWith('/login');
  });
});
