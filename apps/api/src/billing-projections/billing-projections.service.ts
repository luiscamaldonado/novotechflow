import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalStatus, AcquisitionType } from '@prisma/client';
import { AuthenticatedUser } from '../auth/dto/auth.dto';

export interface CreateBillingProjectionDto {
    clientName: string;
    subtotal: number;
    status?: string;
    billingDate?: string | null;
    acquisitionType?: string;
}

export interface UpdateBillingProjectionDto {
    clientName?: string;
    subtotal?: number;
    status?: string;
    billingDate?: string | null;
    acquisitionType?: string;
}

@Injectable()
export class BillingProjectionsService {
    private readonly logger = new Logger(BillingProjectionsService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Generates a unique projection code: PROY-[NOMENCLATURE][SEQUENTIAL]
     */
    private async generateProjectionCode(nomenclature: string, userId: string): Promise<string> {
        const prefix = nomenclature || 'XX';

        const lastProjection = await this.prisma.billingProjection.findFirst({
            where: { userId },
            orderBy: { projectionCode: 'desc' },
            select: { projectionCode: true },
        });

        let nextNumber = 1;

        if (lastProjection?.projectionCode) {
            const match = lastProjection.projectionCode.match(/(\d+)$/);
            if (match) {
                nextNumber = parseInt(match[1], 10) + 1;
            }
        }

        const sequential = nextNumber.toString().padStart(4, '0');
        return `PROY-${prefix}${sequential}`;
    }

    /**
     * Creates a new billing projection entry.
     */
    async create(userId: string, data: CreateBillingProjectionDto) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('Usuario no encontrado.');

        const projectionCode = await this.generateProjectionCode(user.nomenclature, userId);

        return this.prisma.billingProjection.create({
            data: {
                userId,
                projectionCode,
                clientName: data.clientName.trim().toUpperCase(),
                subtotal: data.subtotal,
                status: (data.status as ProposalStatus) || ProposalStatus.PENDIENTE_FACTURAR,
                billingDate: data.billingDate ? new Date(data.billingDate) : null,
                acquisitionType: data.acquisitionType ? (data.acquisitionType as AcquisitionType) : undefined,
            },
            include: {
                user: { select: { name: true, nomenclature: true } },
            },
        });
    }

    /**
     * Lists billing projections with RBAC filtering.
     */
    async findAll(user: AuthenticatedUser) {
        const accessFilter = user.role === 'ADMIN' ? {} : { userId: user.id };

        return this.prisma.billingProjection.findMany({
            where: accessFilter,
            include: {
                user: { select: { name: true, nomenclature: true } },
            },
            orderBy: { updatedAt: 'desc' },
        });
    }

    /**
     * Updates a billing projection.
     */
    async update(id: string, data: UpdateBillingProjectionDto, user: AuthenticatedUser) {
        const existing = await this.prisma.billingProjection.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Proyección no encontrada.');
        if (user.role !== 'ADMIN' && existing.userId !== user.id) {
            throw new ForbiddenException('No tienes permiso para modificar esta proyección.');
        }

        return this.prisma.billingProjection.update({
            where: { id },
            data: {
                clientName: data.clientName ? data.clientName.trim().toUpperCase() : undefined,
                subtotal: data.subtotal ?? undefined,
                status: data.status ? (data.status as ProposalStatus) : undefined,
                billingDate: data.billingDate ? new Date(data.billingDate) : data.billingDate === null ? null : undefined,
                acquisitionType: data.acquisitionType ? (data.acquisitionType as AcquisitionType) : undefined,
            },
            include: {
                user: { select: { name: true, nomenclature: true } },
            },
        });
    }

    /**
     * Deletes a billing projection.
     */
    async delete(id: string, user: AuthenticatedUser) {
        const existing = await this.prisma.billingProjection.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Proyección no encontrada.');
        if (user.role !== 'ADMIN' && existing.userId !== user.id) {
            throw new ForbiddenException('No tienes permiso para eliminar esta proyección.');
        }

        return this.prisma.billingProjection.delete({ where: { id } });
    }
}
