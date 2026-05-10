import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@novotechno.com' },
    update: {},
    create: {
      email: 'admin@novotechno.com',
      name: 'System Administrator',
      passwordHash: hash,
      role: Role.ADMIN,
      nomenclature: 'ADM'
    },
  });

  console.log('Admin seeded!');

  await prisma.appSetting.upsert({
    where: { key: 'inactivity_timeout_minutes' },
    update: {},
    create: {
      key: 'inactivity_timeout_minutes',
      value: '5',
      description: 'Minutos de inactividad antes de cerrar sesión automáticamente',
    },
  });

  console.log('AppSettings seeded!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
