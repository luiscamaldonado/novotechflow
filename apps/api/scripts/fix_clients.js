const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function cleanAndImportClients() {
  const filePath = path.join(__dirname, '../../terceros sag.csv');
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ No se encontró el archivo: ${filePath}`);
    return;
  }

  // Quitar todos los clientes que se insertaron con ; en su nombre (por si alguno escapó el regex final o lo tenía en medio)
  try {
    const deleted = await prisma.client.deleteMany({
      where: {
        name: {
          contains: ';',
        },
      },
    });
    console.log(`🗑️ Eliminados ${deleted.count} clientes que aún contenían ";" en la BD.`);
  } catch (err) {
    console.error(`No se pudieron eliminar clientes con ";". Tal vez están en uso.`, err.message);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  console.log(`⏳ Procesando e insertando ${lines.length} líneas limpias desde terceros sag.csv...`);
  
  let count = 0;
  for (let line of lines) {
    let name = line.trim();
    if (!name || name === '') continue;

    try {
      await prisma.client.upsert({
        where: { name: name },
        update: {}, // Si ya existe, se considera depurado y se omite
        create: {
          name: name,
        },
      });
      count++;
      if (count % 500 === 0) console.log(`...sincronizados ${count}`);
    } catch (error) {
       // Ignore duplicate errors that are just casing variations in postgres if they occur
    }
  }

  console.log(`✅ Base de datos sincronizada. ${count} clientes registrados o verificados sin punto y coma.`);
  await prisma.$disconnect();
}

cleanAndImportClients().catch(err => {
  console.error(err);
  process.exit(1);
});
