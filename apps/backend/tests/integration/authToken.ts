import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'tu-secreto-super-seguro';

export function createIntegrationToken(permissions: string[]): string {
  return jwt.sign(
    {
      id: 999_998,
      email: 'actor-menu-test@example.test',
      role: 'test',
      permissions,
    },
    JWT_SECRET,
    { expiresIn: '5m' },
  );
}

