const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const sura_sa = await prisma.client.findFirst({
    where: { name: 'SURAMERICANA SA' },
    include: { _count: { select: { proposals: true } } }
  });
  
  const argos_sa = await prisma.client.findFirst({
    where: { name: 'GRUPO ARGOS SA' },
    include: { _count: { select: { proposals: true } } }
  });

  console.log(`SURAMERICANA SA: ${sura_sa ? sura_sa.id : 'No existe'}`);
  console.log(`GRUPO ARGOS SA: ${argos_sa ? argos_sa.id : 'No existe'}`);

  await prisma.$disconnect();
}

check();
