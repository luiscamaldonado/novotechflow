const { PrismaClient } = require('@prisma/client');

class MockPrismaService {
  constructor() {
    this.client = new PrismaClient();
  }
}

async function findWithRelevanceRanking(prisma, query) {
  const normalizedQuery = query?.normalize("NFD").replace(/[\u0300-\u036f]/g, "") || '';
  const rawQuery = normalizedQuery.toUpperCase();
  const terms = rawQuery.split(' ').filter(t => t.length > 0);
  const searchTerm = rawQuery.trim();

  console.log(`Searching for terms: ${JSON.stringify(terms)}`);

  const candidates = await prisma.client.findMany({
    where: {
      AND: terms.map(term => ({
        name: { contains: term, mode: 'insensitive' },
      })),
      isActive: true,
    },
    take: 100,
    select: { id: true, name: true, nit: true },
  });

  console.log(`Found ${candidates.length} candidates`);
  return candidates;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const results = await findWithRelevanceRanking(prisma, 'NUEVO');
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main();
