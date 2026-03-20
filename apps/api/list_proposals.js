const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const proposals = await prisma.proposal.findMany({
    select: { clientName: true, subject: true, createdAt: true }
  });
  console.log(JSON.stringify(proposals, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
