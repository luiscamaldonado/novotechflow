const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const catalogs = [
    { category: 'FORMATO', values: ['LAPTOP', 'DESKTOP SFF', 'DESKTOP TWR', 'ALL IN ONE', 'WORKSTATION'] },
    { category: 'FABRICANTE', values: ['DELL', 'LENOVO', 'HP', 'APPLE', 'ASUS'] },
    { category: 'MODELO', values: ['LATITUDE 5440', 'THINKPAD L14', 'ELITEBOOK 840', 'MACBOOK PRO M3', 'VOSTRO 3400'] },
    { category: 'PROCESADOR', values: ['INTEL CORE I5-1335U', 'INTEL CORE I7-1355U', 'RYZEN 5 7530U', 'RYZEN 7 7730U', 'APPLE M3 CHIP'] },
    { category: 'SISTEMA_OPERATIVO', values: ['WINDOWS 11 PRO', 'WINDOWS 10 PRO', 'MACOS SONOMA', 'UBUNTU LINUX'] },
    { category: 'GRAFICOS', values: ['INTEGRATED INTEL IRIS XE', 'NVIDIA GEFORCE RTX 3050', 'AMD RADEON GRAPHICS', 'APPLE 10-CORE GPU'] },
    { category: 'MEMORIA_RAM', values: ['8GB DDR4', '16GB DDR4', '16GB DDR5', '32GB DDR5'] },
    { category: 'ALMACENAMIENTO', values: ['256GB SSD NVME', '512GB SSD NVME', '1TB SSD NVME', '2TB SSD NVME'] },
    { category: 'PANTALLA', values: ['14.0" FHD (1920X1080) IPS', '15.6" FHD (1920X1080) IPS', '13.3" RETINA DISPLAY', '16.0" QHD+ IPS'] },
    { category: 'NETWORK', values: ['WIFI 6 + BLUETOOTH 5.1', 'WIFI 6E + BLUETOOTH 5.3', 'GIGABIT ETHERNET RJ45', 'INTEL KILLER WIFI'] },
    { category: 'SEGURIDAD', values: ['TPM 2.0 + FINGERPRINT READER', 'TPM 2.0 + IR CAMERA', 'SMART CARD READER', 'KENSINGTON LOCK'] },
    { category: 'GARANTIA_BATERIA', values: ['1 AÑO LIMITADA', '2 AÑOS EXTENDIDA', '3 AÑOS PROSUPPORT'] },
    { category: 'GARANTIA_EQUIPO', values: ['1 AÑO ON-SITE', '3 AÑOS ON-SITE (NBD)', '3 AÑOS PROSUPPORT PLUS', '3 AÑOS ACCIDENTAL DAMAGE'] },
  ];

  for (const item of catalogs) {
    for (const val of item.values) {
      await prisma.catalog.upsert({
        where: { category_value: { category: item.category, value: val } },
        update: {},
        create: { category: item.category, value: val }
      });
    }
  }
  console.log('Catálogos sembrados exitosamente.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
