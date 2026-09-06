import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'tu-secreto-super-seguro';

export function createIntegrationToken(
  permissions: string[],
  actorId = 999_998,
): string {
  return jwt.sign(
    {
      id: actorId,
      email: 'actor-menu-test@example.test',
      role: 'test',
      permissions,
    },
    JWT_SECRET,
    { expiresIn: '5m' },
  );
}

