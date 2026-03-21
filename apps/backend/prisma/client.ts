// prisma/client.ts
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Evita múltiples instancias en desarrollo (hot reload)
const prisma = globalThis.prisma || new PrismaClient();

// Guardar la instancia global en desarrollo para evitar múltiples conexiones
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export default prisma;



































