const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const ELEMENTOS_PATH = 'D:\\elementos novotechflow';

/**
 * Lista de abreviaturas técnicas que SIEMPRE deben ir en MAYÚSCULAS.
 * Se aplican como post-proceso tras el Title Case normal.
 */
const TECH_ABBREVIATIONS = new Set([
  // Memoria RAM
  'DDR', 'DDR3', 'DDR4', 'DDR5', 'DDR6',
  'LPDDR', 'LPDDR3', 'LPDDR4', 'LPDDR4X', 'LPDDR5', 'LPDDR5X', 'LPDDR6',
  'UDIMM', 'SODIMM', 'RDIMM', 'LRDIMM', 'ECC', 'DIMM',
  // Almacenamiento
  'SSD', 'HDD', 'SATA', 'SAS', 'NVME', 'BGA', 'EMMC',
  // Red
  'RJ45', 'WIFI', 'LAN', 'WAN', 'NFC', 'WWAN', 'WLAN', 'USB', 'HDMI',
  'DP', 'VGA', 'BIOS', 'UEFI', 'PCIe', 'PCIE', 'M.2',
  // Seguridad
  'TPM', 'IR',
  // GPU / Gráficos
  'NVIDIA', 'AMD', 'INTEL', 'RTX', 'GTX', 'RX', 'RDNA',
  // OS
  'OS', 'IoT',
  // Genéricas de hardware
  'CPU', 'GPU', 'NPU', 'RAM', 'ROM', 'SoC', 'TDP',
  'GB', 'TB', 'MB', 'GHz', 'MHz', 'RPM', 'KBPS', 'MBPS', 'GBPS',
  'USB-C', 'USB-A', 'RJ-45',
  // Fabricantes / marcas
  'HP', 'IBM', 'POS', 'ASUS',
  // Formatos de PC
  'SFF', 'TWR', 'USFF', 'USDT', 'AIO', 'UHD', 'PC',
]);

/**
 * Normaliza a Title Case preservando abreviaturas técnicas en MAYÚSCULAS.
 * Maneja espacios, guiones y paréntesis.
 */
function toProperTitleCase(str) {
  if (!str) return '';

  // Paso 1: Title Case estándar
  const titleCased = str
    .toLowerCase()
    .replace(/(^|[\s\(\+\/\-])(\w)/g, (match) => match.toUpperCase())
    .trim();

  // Paso 2: Restaurar abreviaturas técnicas a MAYÚSCULAS
  // El regex ahora incluye todos los caracteres alfanuméricos extendidos (incluyendo tildes/eñes)
  return titleCased.replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9.\-]+/g, (token) => {
    const upper = token.toUpperCase();
    // Coincidencia directa (ej: SSD, TPM, RJ45, SFF)
    if (TECH_ABBREVIATIONS.has(upper)) return upper;

    // Protección: si el token original tiene tildes (ya fue title-cased arriba),
    // no lo forzamos a uppercase para evitar "AñOS", "DíAS", "GarantíA".
    if (/[áéíóúñ]/i.test(token)) return token;

    // Patrón DDR4, LPDDR5X, SFF, etc.
    const withoutTrailingAlphaDigits = upper.replace(/\d+[A-Z]*$/, '');
    if (withoutTrailingAlphaDigits && TECH_ABBREVIATIONS.has(withoutTrailingAlphaDigits)) return upper;

    // Patrón numérico+unidad: "16gb" → "16GB", "1.2tb" → "1.2TB"
    const numUnitMatch = upper.match(/^([\d.]+)([A-Z]+)$/);
    if (numUnitMatch) {
      const unit = numUnitMatch[2];
      if (TECH_ABBREVIATIONS.has(unit)) return numUnitMatch[1] + unit;
    }

    return token; // Mantener tal cual (Title Case normal)
  });
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
  'GARANTIA_BATERIA': ['garantia base'],
  'GARANTIA_EQUIPO': ['garantia base', 'servicios warranty pcs']
};

// Encabezados de CSV que deben descartarse
const CSV_HEADERS_TO_SKIP = new Set([
  'especificacion', 'especificación', 'referencia', 'brand family architecture model',
  'modelo', 'categoria', 'descripcion', 'descripción', 'marca'
]);

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
            // Saltar encabezados de CSV
            if (CSV_HEADERS_TO_SKIP.has(raw.toLowerCase())) return;
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
