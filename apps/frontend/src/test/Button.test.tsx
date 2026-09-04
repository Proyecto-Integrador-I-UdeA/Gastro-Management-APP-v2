import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Button from '@/components/Button';

describe('Button', () => {
  it('renderiza su contenido con React Testing Library', () => {
    render(<Button type="button">Guardar</Button>);

    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
  });
});
