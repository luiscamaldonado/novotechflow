const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.client.findMany({
    select: { name: true }
  });
  const withAccents = clients.filter(c => /[áéíóúñÁÉÍÓÚÑ]/.test(c.name));
  console.log(`Total: ${clients.length}`);
  console.log(`With accents: ${withAccents.length}`);
  if (withAccents.length > 0) {
    console.log(`Examples: ${JSON.stringify(withAccents.slice(0, 10), null, 2)}`);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
