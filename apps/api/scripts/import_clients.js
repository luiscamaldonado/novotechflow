const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function importClients() {
  const filePath = path.join(__dirname, '../../terceros.csv');
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ No se encontró el archivo: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  console.log(`⏳ Procesando ${lines.length} líneas...`);
  
  let count = 0;
  for (let line of lines) {
    const name = line.trim();
    if (!name || name === '') continue;

    try {
      await prisma.client.upsert({
        where: { name: name },
        update: {}, // Si ya existe, no hacemos nada
        create: {
          name: name,
        },
      });
      count++;
    } catch (error) {
      console.error(`❌ Error con "${name}":`, error.message);
    }
  }

  console.log(`✅ Importación finalizada. ${count} clientes procesados.`);
  await prisma.$disconnect();
}

importClients().catch(err => {
  console.error(err);
  process.exit(1);
});
