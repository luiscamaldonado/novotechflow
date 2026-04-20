import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from './dto/update-user.dto';

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

    async updateUser(
        targetUserId: string,
        currentUserId: string,
        dto: UpdateUserDto,
    ): Promise<User> {
        // 1. Verificar que el usuario existe
        const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
        if (!target) throw new NotFoundException('User not found');

        // 2. Validar unicidad de email/nomenclature contra OTROS usuarios
        if (dto.email || dto.nomenclature) {
            const orFilters: Prisma.UserWhereInput[] = [];
            if (dto.email) orFilters.push({ email: dto.email });
            if (dto.nomenclature) orFilters.push({ nomenclature: dto.nomenclature });
            const conflict = await this.prisma.user.findFirst({
                where: { id: { not: targetUserId }, OR: orFilters },
            });
            if (conflict) throw new ConflictException('Email or nomenclature already in use');
        }

        // 3. Self-protection
        if (targetUserId === currentUserId) {
            if (dto.role !== undefined && dto.role !== Role.ADMIN) {
                throw new BadRequestException('Cannot change your own role');
            }
            if (dto.isActive === false) {
                throw new BadRequestException('Cannot deactivate yourself');
            }
        }

        // 4. Construir data del update
        const data: Prisma.UserUpdateInput = {};
        if (dto.name !== undefined) data.name = dto.name;
        if (dto.email !== undefined) data.email = dto.email;
        if (dto.nomenclature !== undefined) data.nomenclature = dto.nomenclature;
        if (dto.role !== undefined) data.role = dto.role;
        if (dto.isActive !== undefined) data.isActive = dto.isActive;

        // 5. Password: solo si viene válido
        if (dto.password && dto.password.trim().length > 0) {
            data.passwordHash = await bcrypt.hash(dto.password, 10);
        }

        // 6. Ejecutar update SIN retornar passwordHash
        return this.prisma.user.update({
            where: { id: targetUserId },
            data,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                nomenclature: true,
                signatureUrl: true,
                isActive: true,
                proposalCounterStart: true,
                createdAt: true,
                updatedAt: true,
            },
        }) as unknown as Promise<User>;
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
        return this.prisma.$transaction(async (tx) => {
            // Get all proposal IDs belonging to this user
            const userProposals = await tx.proposal.findMany({
                where: { userId: id },
                select: { id: true },
            });
            const proposalIds = userProposals.map(p => p.id);

            if (proposalIds.length > 0) {
                // Delete proposal page blocks
                await tx.proposalPageBlock.deleteMany({
                    where: { page: { proposalId: { in: proposalIds } } },
                });

                // Delete proposal pages
                await tx.proposalPage.deleteMany({
                    where: { proposalId: { in: proposalIds } },
                });

                // Delete scenario items
                await tx.scenarioItem.deleteMany({
                    where: { scenario: { proposalId: { in: proposalIds } } },
                });

                // Delete scenarios
                await tx.scenario.deleteMany({
                    where: { proposalId: { in: proposalIds } },
                });

                // Delete email logs BEFORE proposal versions (FK: emailLog -> proposalVersion)
                await tx.emailLog.deleteMany({
                    where: { proposalId: { in: proposalIds } },
                });

                // Delete synced files linked to proposals
                await tx.syncedFile.deleteMany({
                    where: { proposalId: { in: proposalIds } },
                });

                // Delete proposal versions
                await tx.proposalVersion.deleteMany({
                    where: { proposalId: { in: proposalIds } },
                });

                // Delete proposal items
                await tx.proposalItem.deleteMany({
                    where: { proposalId: { in: proposalIds } },
                });

                // Delete proposals
                await tx.proposal.deleteMany({
                    where: { userId: id },
                });
            }

            // Delete PDF templates created by this user
            await tx.pdfTemplate.deleteMany({
                where: { createdBy: id },
            });

            // Delete remaining synced files and email logs for user
            await tx.syncedFile.deleteMany({
                where: { userId: id },
            });
            await tx.emailLog.deleteMany({
                where: { userId: id },
            });

            // Delete the user
            return tx.user.delete({
                where: { id },
            });
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
