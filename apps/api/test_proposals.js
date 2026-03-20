const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const proposalCount = await prisma.proposal.count();
  const itemCount = await prisma.proposalItem.count();
  console.log(`Proposals: ${proposalCount}`);
  console.log(`ProposalItems: ${itemCount}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
