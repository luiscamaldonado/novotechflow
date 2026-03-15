const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const ELEMENTOS_PATH = 'D:\\elementos novotechflow';

/**
 * Normaliza a Title Case (Primera letra de cada palabra en Mayúscula).
 * Maneja espacios y paréntesis.
 */
function toProperTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/(^|[\s\(\/])(\w)/g, (match) => match.toUpperCase())
    .trim();
}

const CATEGORY_MAP = {
  'FORMATO': ['formato'],
  'FABRICANTE': ['fabricantes'],
  'MODELO': [
    'desktops asus', 'desktops dell', 'desktops hp', 'desktops lenovo wd', 'desktops lenovo',
    'laptops asus', 'laptops dell', 'laptops hp', 'lenovo tablets wd', 'lenovo wd tp',
    'portatil lenovo tb', 'portatil lenovo', 'POS hp', 'smart lenovo', 'workstation asus',
    'workstation dell', 'ws lenovo desktop', 'ws portatil lenovo wd', 'ws portatil lenovo'
  ],
  'PROCESADOR': ['procesadores'],
  'SISTEMA_OPERATIVO': ['OS'],
  'GRAFICOS': ['graficas'],
  'MEMORIA_RAM': ['memorias'],
  'ALMACENAMIENTO': ['almacenamiento'],
  'PANTALLA': ['display', 'monitores asus', 'monitores dell', 'monitores hp', 'monitores lenovo wd', 'monitores lenovo'],
  'NETWORK': ['network'],
  'SEGURIDAD': ['security'],
  'GARANTIA_BATERIA': ['servicios warranty pcs'],
  'GARANTIA_EQUIPO': ['servicios warranty pcs']
};

async function main() {
  console.log('--- REINICIO TOTAL DE CATÁLOGOS ---');
  
  // Limpieza agresiva
  const count = await prisma.catalog.deleteMany({});
  console.log(`Borrados ${count.count} registros previos.`);

  for (const [category, files] of Object.entries(CATEGORY_MAP)) {
    const valuesMap = new Map(); // Usamos Map para deduplicación case-insensitive

    for (const file of files) {
      const p = path.join(ELEMENTOS_PATH, file + '.csv');
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        content.split(/\r?\n/).forEach(line => {
          const raw = line.split(',')[0]?.trim();
          if (raw && raw.length > 1) {
            const normalized = toProperTitleCase(raw);
            const key = normalized.toLowerCase();
            // Solo lo agregamos si no existe ya (deduplicación real)
            if (!valuesMap.has(key) && normalized.toUpperCase() !== category) {
              valuesMap.set(key, normalized);
            }
          }
        });
      }
    }

    const data = Array.from(valuesMap.values()).map(v => ({ category, value: v, isActive: true }));
    console.log(`${category}: Insertando ${data.length} ítems unificados...`);
    
    await prisma.catalog.createMany({
      data,
      skipDuplicates: true
    });
  }

  console.log('Sincronización terminada con éxito.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
