const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.user.update({
        where: { nomenclature: 'ADM' },
        data: { email: 'admin@novotechno.com' }
    });
    console.log('Email updated successfully to admin@novotechno.com!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
