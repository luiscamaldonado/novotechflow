import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const templates = await prisma.pdfTemplate.count();
  console.log('Templates:', templates);
  
  const pages = await prisma.proposalPage.findMany({
    take: 3,
    select: { id: true, title: true, pageType: true }
  });
  console.log('Pages:', JSON.stringify(pages, null, 2));
  
  const blocks = await prisma.proposalPageBlock.findMany({
    take: 3,
    select: { id: true, content: true }
  });
  console.log('Blocks:', JSON.stringify(blocks, null, 2));
}
main().finally(() => prisma.$disconnect());