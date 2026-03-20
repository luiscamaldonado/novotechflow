const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.count();
  const clients = await prisma.client.count();
  const proposals = await prisma.proposal.count();
  const proposalItems = await prisma.proposalItem.count();
  const scenarios = await prisma.scenario.count();
  const scenarioItems = await prisma.scenarioItem.count();
  const catalogs = await prisma.catalog.count();
  const pdfTemplates = await prisma.pdfTemplate.count();
  const syncedFiles = await prisma.syncedFile.count();
  const emailLogs = await prisma.emailLog.count();
  const proposalVersions = await prisma.proposalVersion.count();
  const proposalSections = await prisma.proposalSection.count();

  console.log('=== ESTADO DE LA BASE DE DATOS ===');
  console.log(`Users:             ${users}`);
  console.log(`Clients:           ${clients}`);
  console.log(`Proposals:         ${proposals}`);
  console.log(`ProposalItems:     ${proposalItems}`);
  console.log(`ProposalSections:  ${proposalSections}`);
  console.log(`ProposalVersions:  ${proposalVersions}`);
  console.log(`Scenarios:         ${scenarios}`);
  console.log(`ScenarioItems:     ${scenarioItems}`);
  console.log(`Catalogs:          ${catalogs}`);
  console.log(`PdfTemplates:      ${pdfTemplates}`);
  console.log(`SyncedFiles:       ${syncedFiles}`);
  console.log(`EmailLogs:         ${emailLogs}`);
  console.log('==================================');

  if (users > 0) {
    const allUsers = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true } });
    console.log('\nUsuarios existentes:');
    allUsers.forEach(u => console.log(`  - ${u.name} (${u.email}) [${u.role}]`));
  }

  if (catalogs > 0) {
    const categories = await prisma.catalog.groupBy({ by: ['category'], _count: true });
    console.log('\nCatálogos por categoría:');
    categories.forEach(c => console.log(`  - ${c.category}: ${c._count} registros`));
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
