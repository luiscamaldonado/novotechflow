import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalStatus } from '@prisma/client';

/**
 * @interface ICreateProposalInput
 * DTO simplificado para la creación de una propuesta.
 */
interface ICreateProposalInput {
  userId: string;
  clientId?: string;
  clientName: string;
  subject: string;
  issueDate: string;
  validityDays: string;
  validityDate: string;
}

@Injectable()
export class ProposalsService {
  private readonly logger = new Logger(ProposalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca propuestas recientes (último año) que coincidan parcial o totalmente 
   * con el término de búsqueda, ya sea en el nombre del cliente o en el asunto.
   * 
   * @param {string} query - Término de búsqueda (Nombre o parte del nombre).
   * @returns {Promise<any[]>} Lista de propuestas que podrían representar un cruce de cuenta.
   */
  async findPotentialConflicts(query: string): Promise<any[]> {
    const normalizedQuery = query?.trim();

    // Early return si no hay suficiente información para buscar
    if (!normalizedQuery || normalizedQuery.length < 3) {
      return [];
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    return this.prisma.proposal.findMany({
      where: {
        OR: [
          { clientName: { contains: normalizedQuery, mode: 'insensitive' } },
          { subject: { contains: normalizedQuery, mode: 'insensitive' } }
        ],
        createdAt: { gte: oneYearAgo },
      },
      include: {
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10, // Limitamos para evitar sobrecarga visual
    });
  }

  /**
   * Orquesta la creación de una nueva propuesta comercial.
   * 
   * @param {string} userId - ID del usuario comercial que crea la oferta.
   * @param {ICreateProposalInput} data - Payload con la información de la propuesta.
   * @throws {NotFoundException} Si el usuario no existe.
   */
  async createProposal(userId: string, data: ICreateProposalInput) {
    try {
      const user = await this.validateUserAccess(userId);
      const clientId = await this.ensureClientExists(data.clientName, data.clientId);
      const proposalCode = await this.generateProposalCode(user.nomenclature, userId);

      return await this.prisma.proposal.create({
        data: {
          proposalCode,
          userId,
          clientId,
          clientName: data.clientName.trim().toUpperCase(),
          subject: data.subject,
          issueDate: new Date(data.issueDate),
          validityDays: typeof data.validityDays === 'string' ? parseInt(data.validityDays, 10) : data.validityDays,
          validityDate: new Date(data.validityDate),
          status: ProposalStatus.DRAFT,
        },
      });
    } catch (error) {
      this.logger.error(`Falla al crear propuesta para usuario ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Valida la existencia del usuario y su capacidad para crear propuestas.
   * @private
   */
  private async validateUserAccess(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    // Early return pattern para validación
    if (!user) {
      throw new NotFoundException(`El usuario con ID ${userId} no fue encontrado en el sistema.`);
    }
    
    return user;
  }

  /**
   * Garantiza que el cliente esté registrado en la base de datos centralizada (Master Data).
   * Implementa un patrón Upsert para evitar duplicidad de nombres normalizados.
   * @private
   */
  private async ensureClientExists(name: string, existingId?: string): Promise<string> {
    const normalizedName = name.trim().toUpperCase();
    
    // Si ya tenemos un ID verificado, lo usamos directamente (OCP)
    if (existingId) return existingId;

    // Si no, realizamos un registro automático
    const client = await this.prisma.client.upsert({
      where: { name: normalizedName },
      update: {}, 
      create: {
        name: normalizedName,
        isActive: true
      }
    });

    return client.id;
  }

  /**
   * Genera un código de propuesta único siguiendo el estándar corporativo COT-[NOMENCLATURA][SECUENCIAL]-[VERSION].
   * @private
   */
  private async generateProposalCode(nomenclature: string, userId: string): Promise<string> {
    const prefix = nomenclature || 'XX';
    
    // Buscamos la última propuesta de este usuario para obtener el número secuencial más alto
    const lastProposal = await this.prisma.proposal.findFirst({
      where: { userId },
      orderBy: { proposalCode: 'desc' },
      select: { proposalCode: true }
    });
    
    let nextNumber = 1;
    
    if (lastProposal?.proposalCode) {
      // Extraemos el número del formato COT-PREFIX0001-1 usando regex
      // El patrón busca dígitos antes del guion de la versión final
      const match = lastProposal.proposalCode.match(/(\d+)-\d+$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    const sequential = nextNumber.toString().padStart(4, '0');
    
    // El "-1" representa la versión inicial del borrador
    return `COT-${prefix}${sequential}-1`;
  }

  /**
   * Recupera una propuesta con sus ítems asociados para edición.
   */
  async getProposalById(id: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: {
        proposalItems: { orderBy: { sortOrder: 'asc' } }
      }
    });

    if (!proposal) throw new NotFoundException('Propuesta no encontrada.');
    return proposal;
  }

  /**
   * Actualiza los datos generales de una propuesta existente.
   * 
   * @param {string} id - UUID de la propuesta.
   * @param {any} data - Nuevos datos (asunto, fechas, etc).
   */
  async updateProposal(id: string, data: any) {
    return this.prisma.proposal.update({
      where: { id },
      data: {
        subject: data.subject,
        issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
        validityDays: data.validityDays ? parseInt(data.validityDays, 10) : undefined,
        validityDate: data.validityDate ? new Date(data.validityDate) : undefined,
      }
    });
  }

  /**
   * Añade un nuevo ítem (producto/servicio) a la propuesta.
   * Gestiona el correlativo de orden (sortOrder) automáticamente.
   */
  async addProposalItem(proposalId: string, data: any) {
    const aggregate = await this.prisma.proposalItem.aggregate({
      where: { proposalId },
      _max: { sortOrder: true }
    });

    const nextOrder = (aggregate._max.sortOrder || 0) + 1;

    return this.prisma.proposalItem.create({
      data: {
        proposalId,
        itemType: data.itemType,
        name: data.name,
        description: data.description,
        brand: data.brand,
        partNumber: data.partNumber,
        quantity: parseFloat(data.quantity) || 1,
        unitCost: parseFloat(data.unitCost) || 0,
        marginPct: parseFloat(data.marginPct) || 0,
        unitPrice: parseFloat(data.unitPrice) || 0,
        isTaxable: data.isTaxable ?? true,
        technicalSpecs: data.technicalSpecs || {},
        sortOrder: nextOrder,
      }
    });
  }

  /**
   * Elimina un ítem específico de una propuesta.
   */
  async removeProposalItem(itemId: string) {
    return this.prisma.proposalItem.delete({
      where: { id: itemId }
    });
  }

  /**
   * Lista propuestas filtradas por control de acceso basado en rol (RBAC).
   * ADMIN tiene visibilidad total; COMERCIAL solo ve las propias.
   *
   * @param {any} user - Objeto del usuario autenticado (proviene del JWT payload).
   * @returns Lista de propuestas con datos del comercial asociado.
   */
  async findAll(user: any) {
    // Si es ADMIN, ve todo. Si no, solo lo propio.
    const accessFilter = user.role === 'ADMIN' ? {} : { userId: user.id };
    
    return this.prisma.proposal.findMany({
      where: accessFilter,
      include: {
        user: { select: { name: true, nomenclature: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Elimina una propuesta completa y sus dependencias.
   * Implementa limpieza manual de ítems previa a la eliminación de la cabecera.
   */
  async deleteProposal(id: string) {
    // 1. Eliminar ítems hijos
    await this.prisma.proposalItem.deleteMany({ where: { proposalId: id } });

    // 2. Eliminar cabecera
    return this.prisma.proposal.delete({ where: { id } });
  }
}
