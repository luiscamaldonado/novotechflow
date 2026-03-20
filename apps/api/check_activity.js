const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const activeCount = await prisma.client.count({where:{isActive:true}});
  const inactiveCount = await prisma.client.count({where:{isActive:false}});
  const nullCount = await prisma.client.count({where:{isActive: null}});
  console.log(`Active: ${activeCount}`);
  console.log(`Inactive: ${inactiveCount}`);
  console.log(`Null: ${nullCount}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
