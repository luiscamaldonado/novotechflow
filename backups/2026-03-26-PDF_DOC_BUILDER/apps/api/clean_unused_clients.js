const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function deepCleanAndImport() {
  const filePath = path.join(__dirname, '../../terceros sag.csv');
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const cleanLines = content.split('\n').map(l => l.trim()).filter(l => l);
  const cleanSet = new Set(cleanLines);

  console.log("⏳ Limpiando elementos sucios de la BD...");
  
  // Buscar clientes en BD
  const clients = await prisma.client.findMany({
    include: {
      _count: {
        select: { proposals: true }
      }
    }
  });

  let deletedCount = 0;
  for (let c of clients) {
    // Si el nombre 'sucio' (. o espacios de más) no está en el CSV ultra-limpio
    // y no tiene propuestas enlazadas, podemos borrarlo tranquilamente.
    if (!cleanSet.has(c.name) && c._count.proposals === 0) {
      await prisma.client.delete({ where: { id: c.id } });
      deletedCount++;
    }
  }

  console.log(`🗑️ Se eliminaron ${deletedCount} registros antiguos/sucios sin propuestas vinculadas.`);

  console.log(`⏳ Insertando/verificando ${cleanLines.length} clientes ultra-limpios...`);
  
  let count = 0;
  for (let name of cleanLines) {
    try {
      await prisma.client.upsert({
        where: { name: name },
        update: {}, 
        create: {
          name: name,
        },
      });
      count++;
    } catch (error) {
       // Ignoramos conflictos de db de capitalización (ej: "A" vs "a")
    }
  }

  console.log(`✅ Base de datos desparasitada. Total sincronizados: ${count}.`);
  await prisma.$disconnect();
}

deepCleanAndImport().catch(err => {
  console.error(err);
  process.exit(1);
});
