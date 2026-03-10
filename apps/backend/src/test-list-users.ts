import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      roleId: true,
      active: true,
      createdAt: true,
    },
  });

  console.log('Usuarios registrados:');
  console.table(users);
}

main()
  .catch(e => console.error('Error:', e))
  .finally(async () => await prisma.$disconnect());