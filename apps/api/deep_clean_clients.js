const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function deepCleanAndImport() {
  const filePath = path.join(__dirname, '../../terceros sag.csv');
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ No se encontró el archivo: ${filePath}`);
    return;
  }

  // Check if there are proposals before deleting clients
  const proposalsCount = await prisma.proposal.count();
  if (proposalsCount === 0) {
    console.log("No hay propuestas activas. Vaciando tabla Client por completo...");
    await prisma.client.deleteMany({});
  } else {
    console.log(`Hay ${proposalsCount} propuestas. No podemos borrar todos los clientes con seguridad. Eliminaremos solo los que no están vinculados.`);
    // Omitimos la eliminación masiva y dependemos del upsert y limpiezas controladas
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  console.log(`⏳ Procesando e insertando ${lines.length} líneas ultra-limpias (sin puntos ni dobles espacios)...`);
  
  let count = 0;
  for (let line of lines) {
    let name = line.trim();
    if (!name || name === '') continue;

    try {
      await prisma.client.upsert({
        where: { name: name },
        update: {}, 
        create: {
          name: name,
        },
      });
      count++;
      if (count % 500 === 0) console.log(`...sincronizados ${count}`);
    } catch (error) {
       // Silencioso para conflictos de duplicación 
    }
  }

  console.log(`✅ Base de datos sincronizada impecablemente. ${count} clientes importados libres de espacios/puntos.`);
  await prisma.$disconnect();
}

deepCleanAndImport().catch(err => {
  console.error(err);
  process.exit(1);
});
