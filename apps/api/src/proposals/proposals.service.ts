import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProposalsService {
    constructor(private prisma: PrismaService) { }

    async searchClients(query: string) {
        if (!query) return [];

        const clients = await this.prisma.proposal.findMany({
            where: {
                clientName: {
                    contains: query,
                    mode: 'insensitive',
                },
            },
            select: {
                clientName: true
            },
            distinct: ['clientName'],
            take: 10,
        });

        return clients.map(c => c.clientName);
    }

    async getRecentProposalsByClient(clientName: string) {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        return this.prisma.proposal.findMany({
            where: {
                clientName,
                createdAt: {
                    gte: oneYearAgo,
                },
            },
            include: {
                user: {
                    select: { name: true },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async createProposal(userId: string, data: any) {
        // Obtenemos la nomenclatura del usuario comercial
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error("Usuario no encontrado");

        const nomenclature = user.nomenclature || 'XX';

        // Generar un código de propuesta con nomenclatura y versión
        const count = await this.prisma.proposal.count({
            where: { userId }
        });
        const nextNumber = (count + 1).toString().padStart(4, '0');
        const proposalCode = `COT-${nomenclature}${nextNumber}-1`;

        return this.prisma.proposal.create({
            data: {
                proposalCode,
                userId,
                clientName: data.clientName,
                subject: data.subject,
                issueDate: new Date(data.issueDate),
                validityDays: data.validityDays,
                validityDate: new Date(data.validityDate),
                status: 'DRAFT',
            },
        });
    }

    async getProposalById(id: string) {
        return this.prisma.proposal.findUnique({
            where: { id },
            include: {
                proposalItems: {
                    orderBy: { sortOrder: 'asc' }
                }
            }
        });
    }

    async updateProposal(id: string, data: any) {
        return this.prisma.proposal.update({
            where: { id },
            data: {
                subject: data.subject,
                issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
                validityDays: data.validityDays,
                validityDate: data.validityDate ? new Date(data.validityDate) : undefined,
            }
        });
    }

    async addProposalItem(proposalId: string, data: any) {
        // Get current max sortOrder
        const maxOrder = await this.prisma.proposalItem.aggregate({
            where: { proposalId },
            _max: { sortOrder: true }
        });
        return this.prisma.proposalItem.create({
            data: {
                proposalId,
                itemType: data.itemType, // PRODUCT, SOFTWARE, SERVICE
                name: data.name,
                description: data.description,
                brand: data.brand,
                partNumber: data.partNumber,
                quantity: data.quantity || 1,
                unitCost: data.unitCost || 0,
                marginPct: data.marginPct || 0,
                unitPrice: data.unitPrice || 0,
                isTaxable: data.isTaxable !== undefined ? data.isTaxable : true,
                sortOrder: (maxOrder._max.sortOrder || 0) + 1,
            }
        });
    }

    async removeProposalItem(itemId: string) {
        return this.prisma.proposalItem.delete({
            where: { id: itemId }
        });
    }

    async findAll(user: any) {
        const whereClause = user.role === 'ADMIN' ? {} : { userId: user.id };
        return this.prisma.proposal.findMany({
            where: whereClause,
            include: {
                user: {
                    select: { name: true, nomenclature: true }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    async deleteProposal(id: string) {
        // Eliminar items y demás dependencias si no hay cascade
        await this.prisma.proposalItem.deleteMany({
            where: { proposalId: id }
        });

        return this.prisma.proposal.delete({
            where: { id }
        });
    }
}
