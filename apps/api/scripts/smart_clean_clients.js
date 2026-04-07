const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Función para corregir caracteres corruptos usando códigos Unicode
function fixEncoding(text) {
  if (!text) return '';
  // El caracter que vimos en el log era el símbolo de reemplazo o uno similar
  return text
    .replace(/\ufffd/g, 'Ñ') // Corregir el caracter de reemplazo Unicode
    .replace(/\u001A/g, 'Ñ') // Corregir caracter de sustitución ASCII
    .trim();
}

// Función para normalizar nombres para comparación (quita todo menos letras y números)
function normalizeForComparison(text) {
  return text
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
    .replace(/[^A-Z0-9]/g, '') // Quitar TODO lo que no sea letra o número
    .trim();
}

async function smartClean() {
  console.log('🚀 Iniciando limpieza inteligente de clientes...');
  
  const allClients = await prisma.client.findMany();
  console.log(`📊 Total registros iniciales: ${allClients.length}`);

  const uniqueGroups = new Map(); // normalizado -> { idRepresentativo, nombreOriginal, idsParaBorrar }

  for (const client of allClients) {
    const fixed = fixEncoding(client.name);
    const normalized = normalizeForComparison(fixed);

    if (!normalized) continue;

    if (uniqueGroups.has(normalized)) {
      uniqueGroups.get(normalized).idsParaBorrar.push(client.id);
    } else {
      uniqueGroups.set(normalized, {
        idToKeep: client.id,
        cleanName: fixed.toUpperCase(),
        idsParaBorrar: []
      });
    }
  }

  console.log(`✨ Grupos únicos identificados: ${uniqueGroups.size}`);

  // 1. Actualizar nombres a formato limpio y MAYÚSCULAS
  console.log('📝 Actualizando nombres...');
  const updates = Array.from(uniqueGroups.values()).map(group => 
    prisma.client.update({
      where: { id: group.idToKeep },
      data: { name: group.cleanName }
    })
  );

  // Ejecutar actualizaciones en bloques de 100 para no saturar
  for (let i = 0; i < updates.length; i += 100) {
    await Promise.all(updates.slice(i, i + 100));
  }

  // 2. Eliminar duplicados
  console.log('🗑️ Eliminando duplicados...');
  const allIdsToDelete = Array.from(uniqueGroups.values()).flatMap(v => v.idsParaBorrar);
  
  if (allIdsToDelete.length > 0) {
    // Borrar en bloques de 500
    for (let i = 0; i < allIdsToDelete.length; i += 500) {
      const chunk = allIdsToDelete.slice(i, i + 500);
      await prisma.client.deleteMany({
        where: { id: { in: chunk } }
      });
    }
  }

  console.log(`✅ ¡Limpieza exitosa!`);
  console.log(`📊 Clientes únicos: ${uniqueGroups.size}`);
  console.log(`🗑️ Duplicados eliminados: ${allIdsToDelete.length}`);
  
  await prisma.$disconnect();
}

smartClean().catch(console.error);
