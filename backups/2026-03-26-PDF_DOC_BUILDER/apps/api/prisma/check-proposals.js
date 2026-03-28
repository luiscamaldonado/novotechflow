const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const proposals = await p.proposal.findMany({
    include: { user: { select: { name: true, id: true, nomenclature: true } } },
  });
  console.log('=== PROPOSALS ===');
  proposals.forEach(pr => {
    console.log(`ID: ${pr.id}`);
    console.log(`Code: ${pr.proposalCode}`);
    console.log(`Client: ${pr.clientName}`);
    console.log(`Status: ${pr.status}`);
    console.log(`UserId: ${pr.userId}`);
    console.log(`User: ${pr.user.name} (${pr.user.id})`);
    console.log('---');
  });

  const users = await p.user.findMany({ select: { id: true, name: true, email: true } });
  console.log('\n=== USERS ===');
  users.forEach(u => console.log(`${u.id} | ${u.name} | ${u.email}`));
}

main().catch(console.error).finally(() => p.$disconnect());
