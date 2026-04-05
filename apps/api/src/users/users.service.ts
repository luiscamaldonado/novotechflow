import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async findOneByEmail(email: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { email },
        });
    }

    async findOneById(id: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                nomenclature: true,
                signatureUrl: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        }) as unknown as Promise<User | null>;
    }

    async createUser(data: Prisma.UserCreateInput): Promise<User> {
        const existingUser = await this.prisma.user.findFirst({
            where: {
                OR: [{ email: data.email }, { nomenclature: data.nomenclature }],
            },
        });

        if (existingUser) {
            throw new ConflictException('Email or nomenclature already exists');
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(data.passwordHash, saltRounds);

        return this.prisma.user.create({
            data: {
                ...data,
                passwordHash,
            },
        });
    }

    async findAll() {
        return this.prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                nomenclature: true,
                signatureUrl: true,
                isActive: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    async deleteUser(id: string) {
        // Get all proposal IDs belonging to this user
        const userProposals = await this.prisma.proposal.findMany({
            where: { userId: id },
            select: { id: true },
        });
        const proposalIds = userProposals.map(p => p.id);

        if (proposalIds.length > 0) {
            // Delete proposal page blocks
            await this.prisma.proposalPageBlock.deleteMany({
                where: { page: { proposalId: { in: proposalIds } } },
            });

            // Delete proposal pages
            await this.prisma.proposalPage.deleteMany({
                where: { proposalId: { in: proposalIds } },
            });

            // Delete scenario items
            await this.prisma.scenarioItem.deleteMany({
                where: { scenario: { proposalId: { in: proposalIds } } },
            });

            // Delete scenarios
            await this.prisma.scenario.deleteMany({
                where: { proposalId: { in: proposalIds } },
            });

            // Delete email logs BEFORE proposal versions (FK: emailLog -> proposalVersion)
            await this.prisma.emailLog.deleteMany({
                where: { proposalId: { in: proposalIds } },
            });

            // Delete synced files linked to proposals
            await this.prisma.syncedFile.deleteMany({
                where: { proposalId: { in: proposalIds } },
            });

            // Delete proposal versions
            await this.prisma.proposalVersion.deleteMany({
                where: { proposalId: { in: proposalIds } },
            });

            // Delete proposal items
            await this.prisma.proposalItem.deleteMany({
                where: { proposalId: { in: proposalIds } },
            });

            // Delete proposals
            await this.prisma.proposal.deleteMany({
                where: { userId: id },
            });
        }

        // Delete PDF templates created by this user
        await this.prisma.pdfTemplate.deleteMany({
            where: { createdBy: id },
        });

        // Delete remaining synced files and email logs for user
        await this.prisma.syncedFile.deleteMany({
            where: { userId: id },
        });
        await this.prisma.emailLog.deleteMany({
            where: { userId: id },
        });

        // Delete the user
        return this.prisma.user.delete({
            where: { id },
        });
    }

    async updateSignature(id: string, signatureUrl: string) {
        return this.prisma.user.update({
            where: { id },
            data: { signatureUrl },
            select: {
                id: true,
                name: true,
                signatureUrl: true,
            },
        });
    }

    async deleteSignature(id: string) {
        return this.prisma.user.update({
            where: { id },
            data: { signatureUrl: null },
            select: {
                id: true,
                name: true,
                signatureUrl: true,
            },
        });
    }
}
