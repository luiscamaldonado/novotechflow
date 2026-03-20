const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

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
      role: 'ADMIN',
      nomenclature: 'ADM',
    },
  });

  console.log('Admin seeded!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
