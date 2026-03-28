const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  const clientCount = await prisma.client.count();
  const catalogCount = await prisma.catalog.count();
  console.log(`Users: ${userCount}`);
  console.log(`Clients: ${clientCount}`);
  console.log(`Catalogs: ${catalogCount}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
