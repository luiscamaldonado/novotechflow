const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const activeCount = await prisma.client.count({where:{isActive:true}});
  const inactiveCount = await prisma.client.count({where:{isActive:false}});
  console.log(`Active: ${activeCount}`);
  console.log(`Inactive: ${inactiveCount}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
