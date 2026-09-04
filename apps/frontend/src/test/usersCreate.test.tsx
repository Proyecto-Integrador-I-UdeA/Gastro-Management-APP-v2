import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CreateUser from '@/pages/users/create';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  push: vi.fn(),
  useAuthGuard: vi.fn(),
}));

vi.mock('@/utils/api', () => ({ api: { post: mocks.post } }));
vi.mock('next/router', () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('@/hooks/useAuthGuard', () => ({
  useAuthGuard: mocks.useAuthGuard,
}));
vi.mock('@/components/layouts/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/utils/toast', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

function getInput(name: string): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!input) throw new Error(`No se encontró el input ${name}`);
  return input;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.post.mockResolvedValue({ data: {} });
});

describe('/users/create', () => {
  it('conserva selector de rol y crea mediante POST /users', async () => {
    render(<CreateUser />);
    const user = userEvent.setup();
    const roleSelect = document.querySelector<HTMLSelectElement>('select[name="roleId"]');

    expect(screen.getByText('Rol')).toBeInTheDocument();
    expect(roleSelect).not.toBeNull();

    await user.type(getInput('email'), 'collaborator@example.test');
    await user.type(getInput('password'), 'password-seguro');
    await user.type(getInput('fullName'), 'Colaborador de Prueba');
    await user.selectOptions(roleSelect!, '2');
    await user.click(screen.getByRole('button', { name: 'Guardar Usuario' }));

    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith('/users', {
        email: 'collaborator@example.test',
        password: 'password-seguro',
        fullName: 'Colaborador de Prueba',
        roleId: 2,
      });
    });
    expect(mocks.post).not.toHaveBeenCalledWith('/auth/register', expect.anything());
    expect(mocks.useAuthGuard).toHaveBeenCalledWith('users.create');
  });
});
