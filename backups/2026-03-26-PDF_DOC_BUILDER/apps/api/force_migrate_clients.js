const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  const clients = await prisma.client.findMany();
  
  for (let c of clients) {
    if (c.name.includes('.')) {
      // Create the CLEAN version of the name
      let cleanName = c.name
        .replace(/;/g, '')
        .replace(/\bS\s*\.?\s*A\s*\.?\s*S\s*\.?\b/gi, 'SAS')
        .replace(/\bS\s*\.?\s*A\s*\.?\b/gi, 'SA')
        .replace(/\bL\s*\.?\s*T\s*\.?\s*D\s*\.?\s*A\s*\.?\b/gi, 'LTDA')
        .replace(/\./g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanName !== c.name) {
        console.log(`Migrando: "${c.name}" -> "${cleanName}"`);
        
        // Find if the clean version already exists
        const existingClean = await prisma.client.findUnique({
          where: { name: cleanName }
        });

        if (existingClean) {
          if (existingClean.id === c.id) continue;
          
          console.log(`  - Fusionando con cliente existente ID: ${existingClean.id}`);
          // Move all proposals to the clean client
          await prisma.proposal.updateMany({
            where: { clientId: c.id },
            data: { clientId: existingClean.id, clientName: cleanName }
          });
          
          // Delete the old dirty client
          await prisma.client.delete({ where: { id: c.id } });
        } else {
          console.log(`  - Renombrando cliente...`);
          // Just rename the existing client
          await prisma.client.update({
            where: { id: c.id },
            data: { name: cleanName }
          });
          
          // Also update proposals names for denormalization if any
          await prisma.proposal.updateMany({
             where: { clientId: c.id },
             data: { clientName: cleanName }
          });
        }
      }
    }
  }

  console.log('Migración finalizada.');
  await prisma.$disconnect();
}

migrate();
